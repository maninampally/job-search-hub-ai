const { google } = require("googleapis");
const { env } = require("../config/env");

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.REDIRECT_URI
);

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function createGmailClient(tokens) {
  oauth2Client.setCredentials(tokens);
  return google.gmail({ version: "v1", auth: oauth2Client });
}

module.exports = {
  oauth2Client,
  GMAIL_SCOPES,
  createGmailClient,
};
