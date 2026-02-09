# Setup Guide

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Webcam (mandatory for interviews)

## Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenAI API key:
```
PORT=5000
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key_here
```

5. Build the TypeScript code:
```bash
npm run build
```

6. Start the development server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

## Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file (optional, defaults are set):
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Running the Application

1. Start the backend server first (port 5000)
2. Start the frontend server (port 3000)
3. Open `http://localhost:3000` in your browser
4. Grant camera permissions when prompted
5. Select an interview type and begin

## Development Commands

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Frontend
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Troubleshooting

### Camera Access Issues
- Ensure your browser has camera permissions
- Use HTTPS in production (required for camera access)
- Check browser console for permission errors

### OpenAI API Errors
- Verify your API key is correct in `.env`
- Check your OpenAI account has sufficient credits
- Review API rate limits

### Socket.IO Connection Issues
- Ensure backend is running before frontend
- Check CORS settings in backend
- Verify `FRONTEND_URL` matches your frontend URL
