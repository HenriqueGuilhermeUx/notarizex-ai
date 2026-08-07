const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error('android/app/build.gradle não encontrado. Rode expo prebuild antes.');
  process.exit(1);
}

let source = fs.readFileSync(gradlePath, 'utf8');

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findBlock(text, name) {
  const marker = name + ' {';
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const open = text.indexOf('{', start);
  const close = findMatchingBrace(text, open);
  if (close < 0) return null;
  return { start, open, close, body: text.slice(open + 1, close) };
}

const signingBlock = findBlock(source, 'signingConfigs');
if (!signingBlock) {
  console.error('Bloco signingConfigs não encontrado em android/app/build.gradle.');
  process.exit(1);
}

if (!signingBlock.body.includes('smartbotsRelease')) {
  const releaseSigning = `
        smartbotsRelease {
            if (project.hasProperty('SMARTBOTS_UPLOAD_STORE_FILE')) {
                storeFile file(SMARTBOTS_UPLOAD_STORE_FILE)
                storePassword SMARTBOTS_UPLOAD_STORE_PASSWORD
                keyAlias SMARTBOTS_UPLOAD_KEY_ALIAS
                keyPassword SMARTBOTS_UPLOAD_KEY_PASSWORD
            }
        }
`;
  source = source.slice(0, signingBlock.close) + releaseSigning + source.slice(signingBlock.close);
}

const releaseMarker = 'release {';
const releaseStart = source.indexOf(releaseMarker);
if (releaseStart < 0) {
  console.error('Bloco release não encontrado em android/app/build.gradle.');
  process.exit(1);
}
const releaseOpen = source.indexOf('{', releaseStart);
const releaseClose = findMatchingBrace(source, releaseOpen);
let releaseBody = source.slice(releaseOpen + 1, releaseClose);

if (releaseBody.includes('signingConfig signingConfigs.debug')) {
  releaseBody = releaseBody.replace(/signingConfig\s+signingConfigs\.debug/g, 'signingConfig signingConfigs.smartbotsRelease');
} else if (!releaseBody.includes('signingConfig signingConfigs.smartbotsRelease')) {
  releaseBody = `
            signingConfig signingConfigs.smartbotsRelease` + releaseBody;
}

source = source.slice(0, releaseOpen + 1) + releaseBody + source.slice(releaseClose);

fs.writeFileSync(gradlePath, source);
console.log('Android release signing configurado para SmartBots.');
