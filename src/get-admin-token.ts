
import fs from 'fs';

async function getToken() {
    try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@saiphani.com',
                password: 'AdminPassword123!'
            })
        });

        const data = await response.json() as any;

        if (data.status === 'success') {
            const token = data.data.tokens.accessToken;
            fs.writeFileSync('token.txt', token);
            console.log('Token saved to token.txt');
        } else {
            console.error('Login failed:', data);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

getToken();
