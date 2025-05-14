import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(req: NextRequest) {
  let browser;
  try {
    const body = await req.json();
    const htmlContent = body.html;

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // Launch Puppeteer browser
    // Note: In serverless environments, you might need puppeteer-core and provide an executablePath.
    // For local development and typical server setups, puppeteer should work fine.
    // Adding '--no-sandbox' and '--disable-setuid-sandbox' flags can help in some environments,
    // but be aware of the security implications.
    browser = await puppeteer.launch({
      headless: true, // Run in headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Potentially other args needed for specific environments (e.g., Docker)
      ],
    });
    const page = await browser.newPage();

    // Set the HTML content for the page
    // waitUntil: 'networkidle0' can be useful if your HTML loads external resources
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    // Generate PDF
    // You can customize PDF options here (e.g., format, margins, printBackground)
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true, // Important for including background colors/images
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    });

    // Send the PDF buffer as a response
    const response = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });

    return response;

  } catch (error) {
    console.error('Error generating PDF with Puppeteer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to generate PDF', details: errorMessage }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close(); // Ensure browser is closed
    }
  }
}