import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const markdownText = body.markdown;

    if (typeof markdownText !== 'string') {
      return NextResponse.json({ error: 'Invalid markdown input' }, { status: 400 });
    }

    // Determine the path to the Python script.
    // __dirname in Vercel/Next.js API routes points to the .next/server/app/api/markdown directory.
    // We need to go up a few levels to reach the project root where snowdown.py is.
    // Adjust the path based on your project structure if snowdown.py is located elsewhere.
    const scriptPath = path.resolve(process.cwd(), 'snowdown.py');
    // For local development, you might need a different path if process.cwd() is not the project root.
    // const scriptPath = path.resolve(__dirname, '../../../../../snowdown.py'); // Example for Vercel deployment structure


    const pythonProcess = spawn('python3', [scriptPath]);

    let htmlOutput = '';
    let errorOutput = '';

    pythonProcess.stdin.write(markdownText);
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      htmlOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0 || errorOutput) {
          console.error(`Python script error: ${errorOutput}`);
          console.error(`Python script exit code: ${code}`);
          resolve(NextResponse.json({ error: 'Error processing markdown', details: errorOutput }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ html: htmlOutput }));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Failed to start python process.', err);
        resolve(NextResponse.json({ error: 'Failed to start markdown processing service', details: err.message }, { status: 500 }));
      });
    });

  } catch (error) {
    console.error('API error:', error);
    let message = 'Internal Server Error';
    if (error instanceof Error) {
        message = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
}