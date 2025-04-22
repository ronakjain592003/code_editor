const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Configure paths for compilers
const COMPILERS = {
  python: 'python',
  java: { compiler: 'javac', runner: 'java' },
  c: 'gcc',
  cpp: 'g++'
};

app.use(express.json());
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cleanup function to delete temporary files
function cleanUp(files) {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.error(`Error deleting ${file}:`, err);
      }
    }
  });
}

// Execute code with timeout
function executeCommand(command, input, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const process = exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new Error('Process timed out'));
        } else {
          reject(new Error(stderr || error.message));
        }
      } else {
        resolve(stdout);
      }
    });

    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    }
  });
}

// Language handlers
const handlers = {
  async python(code, input) {
    const tempFile = path.join(__dirname, 'temp.py');
    fs.writeFileSync(tempFile, code);
    const output = await executeCommand(`${COMPILERS.python} "${tempFile}"`, input);
    cleanUp([tempFile]);
    return output;
  },

  async java(code, input) {
    const classNameMatch = code.match(/public\s+class\s+(\w+)/);
    if (!classNameMatch) throw new Error('Java code must contain a public class');
    
    const className = classNameMatch[1];
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const javaFile = path.join(tempDir, `${className}.java`);
    fs.writeFileSync(javaFile, code);

    try {
      await executeCommand(`${COMPILERS.java.compiler} "${javaFile}"`);
      const output = await executeCommand(`${COMPILERS.java.runner} -cp "${tempDir}" ${className}`, input);
      return output;
    } finally {
      cleanUp([javaFile, path.join(tempDir, `${className}.class`)]);
    }
  },

  async c(code, input, ext = 'c') {
    const tempFile = path.join(__dirname, `temp.${ext}`);
    const exeFile = path.join(__dirname, 'temp.exe');
    
    fs.writeFileSync(tempFile, code);
    try {
      await executeCommand(`${COMPILERS[ext]} "${tempFile}" -o "${exeFile}"`);
      const output = await executeCommand(`"${exeFile}"`, input);
      return output;
    } finally {
      cleanUp([tempFile, exeFile]);
    }
  },

  async cpp(code, input) {
    return this.c(code, input, 'cpp');
  }
};

// API endpoint
app.post('/run', async (req, res) => {
  try {
    const { code, input, language } = req.body;
    
    if (!code) throw new Error('No code provided');
    if (!handlers[language]) throw new Error('Unsupported language');
    
    const output = await handlers[language](code, input);
    res.json({ output });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});