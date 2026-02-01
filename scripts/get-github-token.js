#!/usr/bin/env node
import axios from "axios";
import express from "express";

// This script will be used once to get the refresh token
const app = express();
const port = 3000;

// These will be provided by the user
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  process.stderr.write(
    "Please provide GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables"
  );
  process.exit(1);
}

app.get("/", (req, res) => {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo project`;
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    console.log("\n=== GitHub Access Token ===");
    console.log(accessToken);
    console.log(
      "\nPlease save this token and add it to your MCP settings configuration.\n"
    );

    res.send(
      "Token received! You can close this window and check the console output."
    );

    // Give time for the message to be sent before closing
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    process.stderr.write("Error getting token:", error.message);
    res.status(500).send("Error getting token");
    process.exit(1);
  }
});

app.listen(port, () => {
  console.log(
    `\nPlease visit http://localhost:${port} to start the GitHub authorization process.`
  );
});
