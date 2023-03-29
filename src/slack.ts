import { WebClient } from "@slack/web-api";

const client = new WebClient();

const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI = process.env.BASE_URL+'/callback';
const SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'users:read'
]

export const getSlackAuthUrl = () => {
  return `https://slack.com/oauth/v2/authorize?scope=${SCOPES.join(',')}&client_id=${CLIENT_ID}`;
}

export const getSlackTokenFromCode = async (code: string) => {
  if (!CLIENT_ID || !CLIENT_SECRET) 
    throw new Error('Client ID and/or Client Secret is not defined for Slack APIs')
  const auth = await client.oauth.v2.access({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });
  if(!auth?.access_token)
    throw new Error('Authentication Failed!')
  return auth.access_token
}

export const getChannels = async (token: string) => {
  const response = await client.conversations.list({
    token,
  });
  if (!response.ok) {
    throw new Error(response.error)
  }
  return response.channels;
}

const getUserIdMap = async (token: string) => {
  const userIdMap: Map<string, string> = new Map();

  const response = await client.users.list({
    token,
    limit: 100
  });

  if(!response.ok || !response.members) {
    throw new Error(response.error || 'Unable to fetch members');
  }

  for (const member of response.members) {
    if(!member.id || !(member.real_name && member.name)) continue;
    userIdMap.set(member.id, member.real_name || member.name);
  }

  return userIdMap;
}

export const getConversations = async (token: string, channels: string[]) => {
  const responses = []
  const users = await getUserIdMap(token);
  let errorOccured = false;
  const timeLimit = 10 * 60 * 1000 //10 minutes
  for await (const channel of channels) {
    const response = await client.conversations.history({
      channel,
      token,
      oldest: String((Date.now() - timeLimit)/1000),
      limit: 100
    }).catch((err) => {
        console.log(String(err))
        errorOccured = true;
      })
    if(response?.messages && response.messages.length > 0){
      const messages = [];
      for (const message of response.messages) {
        if(!message.text || !message.user || message.text.includes('has joined the channel')) continue;
        const user = users.has(message.user) ? users.get(message.user) : message.user;
        messages.push(`${user}: ${message.text}`)
      }
      messages.reverse();
      responses.push(messages.join('\n'));
    }
  }
  return {
    conversations: responses,
    errorOccured,
  };
} 
