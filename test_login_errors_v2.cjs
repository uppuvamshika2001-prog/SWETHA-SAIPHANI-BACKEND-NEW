const http = require('http');

function postRequest(email, password, description) {
    return new Promise((resolve, reject) => {
        console.log(`Testing: ${description}`);
        const data = JSON.stringify({ email, password });

        const options = {
            hostname: 'localhost',
            port: 8080,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`Status Code: ${res.statusCode}`);
                console.log(`Response Body: ${body}`);
                console.log("-".repeat(30));
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error(`Error: ${error.message}`);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function runTests() {
    // 1. Test Invalid Email
    await postRequest("nonexistent_v3@example.com", "password123", "Invalid Email");

    // 2. Test Invalid Password
    // Using a known user if possible, or we can just try to see if we get "Invalid password" 
    // if we happen to hit a valid email. 
    // Since I can't easily register without writing more complex http code, 
    // I will try the email 'admin@example.com' which is common, 
    // or 'test@example.com'.
    // If they don't exist, I'll get 'Invalid email' again, which at least confirms that part.
    // But I really want to verify 'Invalid password'.
    // I will try to register a user first using another helper function.

    await registerUserAndTest();
}

function registerUser(user) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(user);
        const options = {
            hostname: 'localhost',
            port: 8080,
            path: '/api/auth/register',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body });
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function registerUserAndTest() {
    const user = {
        email: "test_native_http@example.com",
        password: "ValidPassword123!",
        firstName: "Native",
        lastName: "User"
    };

    console.log("Registering temp user...");
    try {
        const res = await registerUser(user);
        console.log("Registration Status:", res.status);
    } catch (e) {
        console.log("Registration failed or user exists");
    }

    await postRequest(user.email, "WrongPassword123!", "Invalid Password");
}

runTests();
