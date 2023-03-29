import dotenv from 'dotenv';
dotenv.config()

import express, { Response } from "express";
import { getSummary } from "./openAi";
import { decrypt, encrypt } from './crypto';
import { addToFile, generateAuthUrl, getTokensFromCode, refreshAccessToken } from './googleDocs';
import { humaniseJiraEvent, queryParamConstructor } from './helpers';
import { getChannels, getConversations, getSlackAuthUrl, getSlackTokenFromCode } from './slack';
import {events} from './jira-events.json';

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(express.json());

app.get('/slack', (_, res) => {
  res.redirect(getSlackAuthUrl())
})

app.get("/channels", async (req, res, next) => {
  try {
    let token: string | undefined = req.headers.authorization
    if(!token) return res.sendStatus(403)
    token = decrypt(token);
    const channels = await getChannels(token);
    return res.status(200).json({
      data: channels
    });
  } catch (e) {
    return next(e);
  }
})

app.post("/generateSummary", async (req, res, next) => {
  try {
    let token: string | undefined = req.headers.authorization
    if(!token) return res.sendStatus(403)
    token = decrypt(token);

    const channels : string[] = req.body.channels
    if(!channels?.length) {
      res.status(400).send("channels is required body parameter")
    }

    const { conversations, errorOccured } = await getConversations(token, channels);
    console.log({conversations, errorOccured })
    if(conversations.length == 0) {
      throw new Error('No conversations happened in the given timeframe!')
    }

    const summary =  await getSummary(conversations)
    const jiraSummary =  await getSummary(events.map(humaniseJiraEvent))

    if(!summary.data || !jiraSummary.data) throw new Error("Failed to generate summary");

    const jiraResponse = jiraSummary.data.choices.map(c => c.text).join(",")
    const slackResponse = summary.data.choices.map(c => c.text).join(",")

    return res.status(200).json({
      slackResponse,
      jiraResponse,
      errorOccured
    })
  } catch (e) {
    return next(e);
  }
})

app.get("/callback", async (req, res, next) => {
  try {
    const code = String(req.query.code);
    if(!code) {
      throw new Error('No Code Found!');
    }
    const accessToken = await getSlackTokenFromCode(code);
    const token = encrypt(accessToken);
    return res.redirect(`/?slackToken=${token}`);
  } catch (e) {
    return next(e);
  }

});

app.get('/google', (_, res) => {
  res.redirect(generateAuthUrl());
})

app.get('/google/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code);
    if(!code) {
      throw new Error('No Code Found!');
    }
    const tokens = await getTokensFromCode(code);
    if (!tokens.access_token || !tokens.refresh_token)
    throw new Error('Tokens not found')
    const params = {
      googleAccessToken: encrypt(tokens.access_token),
      googleRefreshToken: encrypt(tokens.refresh_token),
      googleTokenExpiryDate: tokens.expiry_date
    }
    res.redirect(`/?${queryParamConstructor(params)}`);
  } catch (e) {
    next(e);
  }
})

app.get("/google/refreshAccessToken", async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if(!token)
      throw new Error('Refresh Token not present!');
    const refreshToken = decrypt(token);
    // console.log(refreshToken, req.body)
    const {accessToken, expiryDate} = await refreshAccessToken(refreshToken);
    if (!accessToken || !expiryDate)
      throw new Error('Error Occured!')

    return res.status(200).json({
      googleAccessToken: encrypt(accessToken),
      googleTokenExpiryDate: expiryDate
    })
  } catch (e) {
    return next(e);
  }
});

app.post('/google/addToFile', async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if(!token)
      throw new Error('Access Token not present!');
    const accessToken = decrypt(token);
    // console.log(accessToken, req.body)
    const body = req.body.body;
    if(!body) {
      throw new Error('No body found!')
    }
    // console.log(body)
    const filename = `ACE Slack`
    const docLink = await addToFile(filename, body, accessToken);
    return res.status(200).json({
      data: {
        docLink
      }
    })
  } catch (e) {
    return next(e)
  }
})

app.use((err: Error, _: any, res :Response, __: any) => {
  console.error(err);
  return res.status(500).json({
    error: String(err)
  });
})

app.listen(PORT, () => {
  console.log("listening at", PORT);
});
