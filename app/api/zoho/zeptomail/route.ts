//npm install nodemailer && npm install --save-dev @types/nodemailer

import { NextResponse } from "next/server";
import nodemailer from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer';

// 1. Create the transporter (Inside the route file is fine)
const transport = nodemailer.createTransport({
    host: "smtp.zeptomail.com",
    port: 587,
    auth: {
        user: "emailapikey", 
        pass: process.env.ZEPTOMAIL_PASSWORD, 
    }
});

// 2. Export the POST function
export async function POST(request: Request) {
    try {
        const { email, otp } = await request.json();

        const mailOptions = {
            from: '"Seven Team" <noreply@seven.club>',
            to: email, // Use the email from the request
            subject: 'Verification Code',
            html: `<strong>Your verification code is: ${otp}</strong>`,
        };

        const info: SentMessageInfo = await transport.sendMail(mailOptions);
        
        return NextResponse.json({ 
            success: true, 
            messageId: info.messageId 
        });

    } catch (error) {
        console.error('SMTP/API Error:', error);
        return NextResponse.json(
            { success: false, error: "Failed to send email" }, 
            { status: 500 }
        );
    }
}
