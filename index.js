const {OpenAI} = require('openai');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

const openai = new OpenAI();

// Function to encode image to base64
function encodeBase64(filePath) {
  // Ensure the file path is valid and the file exists.
  if (!fs.existsSync(filePath)) {
    throw new Error('File does not exist.');
  }
  return fs.readFileSync(filePath, 'base64');
}

// Function to extract frames from the video
function extractFrames(videoPath, outputPath, frameRate = 1) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${frameRate}`])
      .output(`${outputPath}/frame-%03d.jpg`)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// Function to analyze image with OpenAI's Vision API
async function analyzeImages(base64Frames) {
  const opts = {
    model: "gpt-4-vision-preview",
    max_tokens: 500,
    messages: [
        {
            role: "user",
            content: [
                { type: "text", text: "These are frames from a video that I want to upload. Generate a compelling description that I can upload along with the video." },
                ...base64Frames.filter((_, index) => index % 10 === 0).map(imageBase64 => ({
                    type: "image_url",
                    image_url: `data:image/jpeg;base64,${imageBase64}`
                })),
            ],
        },
    ],
};

  const response = await openai.chat.completions.create(opts);

  console.log(response.choices[0].message.content);
  return response.choices[0].message.content;
}

// Function to generate voiceover
async function generateVoiceOver(script) {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    input: script,
    voice: "alloy",
  });
  
  const buffer = Buffer.from(await mp3.arrayBuffer());
  fs.writeFileSync('voiceover.mp3', buffer);

  console.log('Voiceover generated and saved as voiceover.mp3');
}


// Main function to process the video
async function processVideo(videoPath) {
  const outputPath = 'frames';

  // Ensure output directory exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  // Extract frames from video
  await extractFrames(videoPath, outputPath, 1); // 1 frame per second

  // Read frame filenames from output directory
  const frameFiles = fs.readdirSync(outputPath).filter(file => file.endsWith('.jpg'));

  // Process all frames in parallel (only recommended for a small number of frames)
  const base64Frames = await Promise.all(frameFiles.map(async frameFile => {
    const imagePath = `${outputPath}/${frameFile}`;
    return encodeBase64(imagePath);

  }));
  const script = await analyzeImages(base64Frames);


  // Generate voiceover based on the script
  await generateVoiceOver(script);
}

// Replace with the path to your video file
const videoPath = './Douchebag Bison.mp4';

// Call the process video function
processVideo(videoPath).catch(console.error);