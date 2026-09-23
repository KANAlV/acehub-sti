# Acehub

A web-based faculty scheduling system that generates class schedules and exports them to **Excel format**.
This project uses **React**, **TailwindCSS**, and **ExcelJS** to create an interactive interface and automatically generate formatted schedule spreadsheets.

---

# Technologies Used

This project was built using the following stack, libraries, and infrastructure:

### **Framework & UI Libraries**
* **Tailwind CSS** – Utility-first CSS framework
* **Flowbite** – UI component library built on top of Tailwind CSS
* **Flowbite React** – Interactive React components powered by Flowbite
* **React Icons** – Icon library for React applications

### **Database & Infrastructure**
* **PostgreSQL** – Relational database management system
* **Neon** – Serverless PostgreSQL database cloud platform
* **Azure** – Microsoft authentication and single sign-on (SSO) integration

### **Storage & File Management**
* **MinIO / Amazon S3** – S3-compatible object storage for documents and file uploads
* **`@aws-sdk/client-s3`** (v3.1138.0) – Official AWS SDK v3 client for object storage integration
* **ExcelJS** – Library used to generate and export schedule spreadsheets (.xlsx)
* **FileSaver.js** – Client-side library used to trigger browser file downloads

### **Package Manager**
* **npm** – Node Package Manager (v12.0.2)

---

# Prerequisites

Before running the project, make sure you have:

* **Node.js installed**
* **npm version 12.0.2 or newer**

Check your npm version:

```bash
npm -v
```

---

## Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites
Make sure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [Git](https://git-scm.com/)

# Installation

Clone the repository:

```bash
git clone https://github.com/kanaiv/acehub-sti.git
```

Go into the project directory:

```bash
cd acehub-sti
```

Install project dependencies:

```bash
npm install
```

---

# Install Required Libraries

If installing manually, install the required packages using:

### TailwindCSS & Tailwind-Scrollbar

```bash
npm install tailwindcss @tailwindcss/postcss postcss tailwind-scrollbar
```

### Flowbite & Flowbite React

```bash
npm install flowbite flowbite-react
```

---

### ExcelJS & FileSaver.js

```bash
npm install exceljs file-saver
```

---

### React Icons

```bash
npm install react-icons
```

---

### Postgres

```bash
npm install postgres
```

---

### AWS-SDK client-s3

```bash
npm install @aws-sdk/client-s3
```

---

### Azure

```bash
npm install @azure/msal-react @azure/msal-browser
```

---