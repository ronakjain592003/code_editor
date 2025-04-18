const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Replace this with your actual Python path
const PYTHON_PATH = 'C:\\Users\\rj949\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';

// Middleware to parse JSON
app.use(express.json());
app.use(express.static('public'));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to run Python code
app.post('/run', (req, res) => {
    const { code, input } = req.body;
    
    // Create a temporary Python file
    const tempFile = path.join(__dirname, 'temp.py');
    fs.writeFileSync(tempFile, code);
    
    // Execute the Python code
    const process = exec(`"${PYTHON_PATH}" "${tempFile}"`, (error, stdout, stderr) => {
        // Delete the temporary file when done
        fs.unlink(tempFile, () => {});
        
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }
        
        res.json({ output: stdout });
    });
    
    // Send input to the process if provided
    if (input) {
        process.stdin.write(input);
        process.stdin.end();
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});