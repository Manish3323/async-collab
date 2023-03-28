const addToSlackButton = document.getElementById('addToSlack');
const generateSummaryButton = document.getElementById('generateSummary');
const summaryBox = document.getElementById('summaryBox');
const slackSummaryParagraph = document.getElementById('slack-summary');
const jiraSummaryParagraph = document.getElementById('jira-summary');
const loading = document.querySelector('.loader')
const channelSelectorBox = document.getElementById('channelSelectorBox');
const channelSelector = document.getElementById('channelSelector');
const applySelectedChannels = document.getElementById('applySelectedChannels');
const resetChannels = document.getElementById('resetChannels');
const addToGoogleDoc = document.getElementById('addToGoogleDoc');
let selectedChannels = [];


generateSummaryButton.style.display = 'none';
summaryBox.style.display = 'none';
addToSlackButton.style.display = 'none';
channelSelectorBox.style.display = 'none';
resetChannels.style.display = 'none';

const showError = (errorMessage) => {
  console.error(errorMessage)
}

const handleChannel = (id) => {
  if (selectedChannels.includes(id)) {
    selectedChannels = selectedChannels.filter(x => x!==id);
  } else {
    selectedChannels.push(id);
  }
  // console.log({selectedChannels})
}



const generateCheckBox = (id, name, checked) => {
  // console.log({id, name, checked, selectedChannels})
  return `<label class="form-control">
    <input type="checkbox" name="checkbox" onclick="handleChannel('${id}') ${checked?'checked':''}"/>
    ${name}
  </label>
  `
}



generateSummaryButton.onclick = async () => {
  generateSummaryButton.style.display = 'none';
  resetChannels.style.display = 'none';
  loading.style.display = 'block'
  console.log('Trying to generate summary')
  const response = await fetch('/generateSummary', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      'authorization': localStorage.getItem('slackToken')
    },
    body: JSON.stringify({
      channels: localStorage.getItem('channels').split(',')
    })
  })
  const data = await response.json();
  console.log({data})
  slackSummaryParagraph.innerText = data.slackResponse.trim();
  jiraSummaryParagraph.innerText = data.jiraResponse.trim();
  loading.style.display = 'none'
  summaryBox.style.display = 'block'
}

applySelectedChannels.onclick = () => {
  localStorage.setItem('channels', selectedChannels.join(','))
  channelSelectorBox.style.display = 'none';
  generateSummaryButton.style.display = 'block';
  resetChannels.style.display = 'block';
}

const addSummaryToGoogleDoc = async () => {
  const body = slackSummaryParagraph.innerText + jiraSummaryParagraph.innerHTML;
  const res = await fetch('/google/addToFile', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      'authorization': localStorage.getItem('googleAccessToken')
    },
    body: JSON.stringify({
      body
    })
  });
  const response = await res.json();
  if(res.status !== 200) {
    throw new Error(response.error)
  }
  // console.log({response})
  const link =  response.data.docLink;
  addToGoogleDoc.innerText = 'Add To Google Doc';
  addToGoogleDoc.style.display = 'none';
  window.open(link, '_blank').focus();
}

const refreshAccessToken = async () => {
  const res = await fetch('/google/refreshAccessToken', {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      'authorization': localStorage.getItem('googleRefreshToken')
    }
  });
  const response = await res.json();
  if(res.status !== 200) {
    throw new Error(response.error)
  }
  localStorage.setItem('googleAccessToken', response.googleAccessToken);
  localStorage.setItem('googleTokenExpiryDate', response.googleTokenExpiryDate);
}

addToGoogleDoc.onclick = async () => {
  try {
    addToGoogleDoc.innerText = 'Loading...';
    addToGoogleDoc.disabled = true;
    if(!localStorage.getItem('googleTokenExpiryDate')) {
      window.open('/google', '_blank').focus();
      return;
    } else if(
      Number(localStorage.getItem('googleTokenExpiryDate')) < 
      Date.now()
    ) {
      await refreshAccessToken().catch((error) => {
        window.open('/google', '_blank').focus();
        throw error;
      });
    }
    await addSummaryToGoogleDoc();
  } catch (error) {
    showError(error);
  }
}

addEventListener("storage", async (event) => {
  if(event.key === 'googleTokenExpiryDate') {
    await addSummaryToGoogleDoc();
  }
});

const showChannelSelector = (channels) => {
  loading.style.display = 'none';
  let innerHTML = '';
  for(let c of channels) {
    innerHTML = innerHTML + generateCheckBox(c.id, c.name, selectedChannels.includes(c.id));
  }
  channelSelector.innerHTML = innerHTML;
  channelSelectorBox.style.display = 'block';
}


const getChannels = async () => {
  try {
    console.log('Trying to get channels')
    const res = await fetch('/channels', {
      headers: {
        'authorization': localStorage.getItem('slackToken')
      }
    })
    const response = await res.json();
    return response.data;
  } catch (error) {
    showError(String(error))
  }
}

resetChannels.onclick = async () => {
  localStorage.removeItem('channels')
  selectedChannels = []
  generateSummaryButton.style.display = 'none';
  resetChannels.style.display = 'none';
  loading.style.display = 'block';
  getChannels().then(showChannelSelector);
}

const main = () => {
  const params = new URLSearchParams(window.location.search);
  if(params.get('slackToken')) {
    localStorage.setItem('slackToken', params.get('slackToken'));
    history.replaceState(null, null, '/');
  }

  if(params.get('googleAccessToken')) {
    localStorage.setItem('googleAccessToken', params.get('googleAccessToken'));
    localStorage.setItem('googleRefreshToken', params.get('googleRefreshToken'));
    localStorage.setItem('googleTokenExpiryDate', params.get('googleTokenExpiryDate'));
    window.close()
  }

  if(localStorage.getItem('slackToken')) {
    addToSlackButton.style.display = 'none'

    if(localStorage.getItem('channels')) {
      selectedChannels = localStorage.getItem('channels').split(',');
      loading.style.display = 'none'
      generateSummaryButton.style.display = 'block';
      resetChannels.style.display = 'block';
    } else {
      getChannels().then(showChannelSelector);
    }
  } else {
    loading.style.display = 'none'
    addToSlackButton.style.display = 'block'
  }

}

main()










//---------------- Background Anumation -------------------------------

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

let nodes = [];

class Node {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > canvas.width) {
      this.vx *= -1;
    }

    if (this.y < 0 || this.y > canvas.height) {
      this.vy *= -1;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2, false);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.closePath();
  }
}

function init() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  for (let i = 0; i < 100; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const vx = Math.random() * 2 - 1;
    const vy = Math.random() * 2 - 1;

    nodes.push(new Node(x, y, vx, vy));
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].update();
    nodes[i].draw();

    for (let j = i + 1; j < nodes.length; j++) {
      const distance = Math.sqrt(
        (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2
      );

      if (distance < 100) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.closePath();
      }
    }
  }

  requestAnimationFrame(animate);
}

init();
animate();