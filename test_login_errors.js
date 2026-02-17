const BASE_URL = "http://localhost:5000/api/auth/login";

async function testLogin(email, password, description) {
    console.log(`Testing: ${description}`);
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        console.log(`Status Code: ${response.status}`);
        const data = await response.json();
        console.log("Response Body:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
    }
    console.log("-".repeat(30));
}

// 1. Test Invalid Email
testLogin("nonexistent@example.com", "password123", "Invalid Email");

// 2. Test Invalid Password (create a user first if needed, but for now we test invalid email)
// To test invalid password, I need a valid user email. I'll try to register one first to be sure.

async function registerAndTestWeakPassword() {
    console.log("Registering a temporary user for password test...");
    const registerUrl = "http://localhost:5000/api/auth/register";
    const tempUser = {
        email: "test_temp_user_login_error@example.com",
        password: "ValidPassword123!",
        firstName: "Temp",
        lastName: "User"
    };

    try {
        // Register
        const regResponse = await fetch(registerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tempUser)
        });

        if (regResponse.status === 201 || regResponse.status === 409) {
            console.log("User registered or already exists. Proceeding to test invalid password.");
            // Test Invalid Password
            await testLogin(tempUser.email, "WrongPassword123!", "Invalid Password");
        } else {
            console.log("Failed to register temp user:", regResponse.status);
            const data = await regResponse.json();
            console.log(data);
        }
    } catch (error) {
        console.error("Registration error:", error);
    }
}

registerAndTestWeakPassword();
