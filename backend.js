const express = require('express');
const {google} = require('googleapis');
const app = express();
const port = 3000;
const {OAuth2} = google.auth;
const fs = require('fs');
const path = require('path');
const cors = require('cors');


function getGoogleApiCreds() {
    try {
        const data = fs.readFileSync(__dirname + '/.SECRET.api.google.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
}

const REDIRECT_URI = 'http://localhost:3000'
const googleApiCreds = getGoogleApiCreds()
const oauth2Client = new OAuth2(
    googleApiCreds["CLIENT_ID"],
    googleApiCreds["CLIENT_SECRET"],
    REDIRECT_URI
);
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

app.use(cors()); // needed for auth

function getStoredToken() {
    const tokenPath = path.join(__dirname, 'token.json');
    try {
        const token = fs.readFileSync(tokenPath, 'utf8');
        return JSON.parse(token);
    } catch (error) {
        console.error('Error reading the token file:', error);
        return null;
    }
}

function getAuthenticatedClient() {
    const token = getStoredToken();

    if (token) {
        oauth2Client.setCredentials(token);
        return oauth2Client;
    } else {
        console.log("No token found. Need authorization.");
        return null;
    }
}

app.get('/', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            const {tokens} = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(path.join(__dirname, 'token.json'), JSON.stringify(tokens));
            res.send('Authentication successful! You can close this page.');
        } catch (error) {
            console.error('Error retrieving access token', error);
            res.status(500).send('Authentication failed.');
        }
    } else {
        res.status(400).send('Invalid request. No code found.');
    }
});

app.get('/authorize', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log(authUrl);
});

app.get('/unread-emails', async (req, res) => {
    try {
        const auth = getAuthenticatedClient();
        if (!auth) {
            res.redirect('/authorize');
            return;
        }
        const gmail = google.gmail({version: 'v1', auth});
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread'
        });
        const unreadCount = response.data.resultSizeEstimate;
        res.send({unreadCount});
    } catch (error) {
        res.status(500).send({error: 'Error fetching unread emails'});
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});