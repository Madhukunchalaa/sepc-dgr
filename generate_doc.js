const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                text: "Physical Server Deployment Guide: DGR Platform",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: "This document outlines the hardware requirements, software stack, and step-by-step process for deploying the distributed DGR Microservices Platform onto a bare-metal physical server.",
                        size: 24,
                        italics: true
                    })
                ],
                spacing: { after: 400 }
            }),

            new Paragraph({
                text: "1. Hardware Requirements (Bare Metal / VM)",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: "Recommended specifications for a smooth production environment:", spacing: { after: 100 } }),
            new Paragraph({ text: "• CPU: 4 Cores (e.g., Intel Xeon or AMD EPYC equivalent)", bullet: { level: 0 } }),
            new Paragraph({ text: "• RAM: 16 GB Recommended to securely hold all Node processes, DB, and Web Server", bullet: { level: 0 } }),
            new Paragraph({ text: "• Storage: 100 GB SSD (NVMe highly preferred)", bullet: { level: 0 } }),
            new Paragraph({ text: "• OS: Ubuntu 22.04 LTS (Highly Recommended)", bullet: { level: 0 }, spacing: { after: 400 } }),

            new Paragraph({
                text: "2. Software Prerequisites",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: "Install the following core software as root on the fresh server:", spacing: { after: 100 } }),
            new Paragraph({ text: "• Node.js (v18.x or v20.x LTS) - Runtime", bullet: { level: 0 } }),
            new Paragraph({ text: "• PostgreSQL (v14 or higher) - Relational DB", bullet: { level: 0 } }),
            new Paragraph({ text: "• PM2 (npm install -g pm2) - Process manager for Node", bullet: { level: 0 } }),
            new Paragraph({ text: "• Nginx - High-performance reverse proxy", bullet: { level: 0 } }),
            new Paragraph({ text: "• Git - CLI source control", bullet: { level: 0 }, spacing: { after: 400 } }),

            new Paragraph({
                text: "3. Database Initialization",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: "Create the specific tables and user role directly in psql terminal:", spacing: { after: 100 } }),
            new Paragraph({
                children: [
                    new TextRun({ text: "CREATE DATABASE dgr_db;\nCREATE USER dgr_admin WITH ENCRYPTED PASSWORD 'YourProtectedPassword!';\nGRANT ALL PRIVILEGES ON DATABASE dgr_db TO dgr_admin;\nALTER DATABASE dgr_db OWNER TO dgr_admin;", font: "Courier New", size: 20 })
                ],
                spacing: { after: 400 }
            }),

            new Paragraph({
                text: "4. Application Configuration",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: "Step 1: Clone the code to /var/www/dgr-platform.", spacing: { after: 50 }}),
            new Paragraph({ text: "Step 2: Install dependencies globally using 'npm run install:all'.", spacing: { after:  50}}),
            new Paragraph({ text: "Step 3: Ensure a root .env file is supplied with DATABASE_URL and JWT_SECRET keys.", spacing: { after: 400 } }),

            new Paragraph({
                text: "5. PM2 Ecosystem Server Startup",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: "Deploy the 6 backend microservices simultaneously using PM2's ecosystem.config.js workflow file. Once instantiated, execute 'pm2 start ecosystem.config.js' and 'pm2 save' to automatically persist the running states through system reboots.", spacing: { after: 400 } }),

            new Paragraph({
                text: "6. Frontend & NGINX Web Build",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: "The React UI should never be run in dev mode in production. Navigate to the frontend directory, and run 'npm run build' to generate static, optimized HTML/JS files into the 'dist' folder.", spacing: { after: 100 }}),
            new Paragraph({ text: "Finally, configure NGINX to serve the frontend dist folder on Port 80, and safely reverse-proxy any /api/* traffic directly to the internal API Gateway operating securely on localhost Port 3000.", spacing: { after: 400 } })
        ],
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync('C:/Users/IE-Admin/Desktop/DGR_Deployment_Architecture.docx', buffer);
    console.log("Improved Document created successfully at Desktop!");
}).catch(console.error);
