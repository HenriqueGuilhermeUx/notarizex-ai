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

const reactBlock = findBlock(source, 'react');
if (reactBlock && !reactBlock.body.includes('debuggableVariants')) {
  const patch = `
    // SmartBots CI embeds index.android.bundle manually before Gradle.
    // Mark release as debuggable only for the React Native Gradle plugin so it does not run Node again.
    // This does not change the Android release signing configuration.
    debuggableVariants = ["debug", "release"]
`;
  source = source.slice(0, reactBlock.close) + patch + source.slice(reactBlock.close);
}

const disableTasks = `
// SmartBots CI: the JS bundle is generated manually by expo export:embed.
// Disable automatic React Native bundle tasks to avoid hidden Node failures inside Gradle.
afterEvaluate {
    tasks.matching { task ->
        task.name == "createBundleReleaseJsAndAssets" ||
        task.name == "bundleReleaseJsAndAssets" ||
        task.name.toLowerCase().contains("bundlereleasejsandassets")
    }.configureEach { task ->
        task.enabled = false
        println("SmartBots CI disabled automatic RN bundle task: " + task.name)
    }
}
`;

if (!source.includes('SmartBots CI: the JS bundle is generated manually')) {
  source += disableTasks;
}

fs.writeFileSync(gradlePath, source);
console.log('Android Gradle configurado para usar bundle JS pré-gerado.');
