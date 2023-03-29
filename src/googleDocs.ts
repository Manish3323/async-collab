import {google} from 'googleapis';
import {OAuth2Client} from 'google-auth-library'
import { generateGoogleDocRequest } from './helpers';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.BASE_URL}/google/callback`;

const createOAuthClient = () => {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

const scopes = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents'
];

export const generateAuthUrl = () => {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

export const getTokensFromCode = async (code: string) => {
  const oauth2Client = createOAuthClient();
    const {tokens} = await oauth2Client.getToken(code)
    console.log(tokens)
    return tokens;
}



const getFiles = async (fileName: string, oauth2Client: OAuth2Client) => {

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const query = `name='${fileName}' and trashed=false`;
  const res = await drive.files.list({ q: query });

  return res.data.files;
}

const createDoc = async (filename: string, oauth2Client: OAuth2Client) => {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType: 'application/vnd.google-apps.document',
    },
  });

  return res.data;
}

export const addToFile = async (filename: string, body: string, accessToken: string) => {
  const oauth2Client = createOAuthClient();
  
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  let docId;

  const files = await getFiles(filename, oauth2Client);
  if(files && files.length > 0) {
    docId = files[0].id;
    // console.log({files})
  } else {
    const doc = await createDoc(filename, oauth2Client);
    docId = doc.id;
    // console.log({files, doc})
  }

  if(!docId)
    throw new Error('Failed to create/load file');

  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  // const requests = [
  //   {
  //     insertText: {
  //       text: body,
  //       endOfSegmentLocation: {},
  //     },
  //   },
  // ];

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: generateGoogleDocRequest(body),
    },
  });

  return `https://docs.google.com/document/d/${docId}`;
}

export const refreshAccessToken = async (refreshToken: string) => {
  const oAuth2Client = createOAuthClient();
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  await oAuth2Client.refreshAccessToken();
  // console.log(oAuth2Client.credentials);
  return {
    accessToken: oAuth2Client.credentials.access_token,
    expiryDate: oAuth2Client.credentials.expiry_date
  };
}