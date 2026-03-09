# Architecture Documentation

## System Overview

The AI Interview Platform is a full-stack application consisting of a Next.js frontend and an Express.js backend, connected via REST APIs and WebSockets.

## Architecture Diagram

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
│                 │
│  - Pages        │
│  - Components   │
│  - Socket.IO    │
└────────┬────────┘
         │
         │ HTTP + WebSocket
         │
┌────────▼────────┐
│  Express API    │
│   (Backend)     │
│                 │
│  - Routes       │
│  - Services     │
│  - Sockets      │
└────────┬────────┘
         │
         │ API Calls
         │
┌────────▼────────┐
│  Groq / LLaMA   │
│   3.1 (External)│
└─────────────────┘
```

## Backend Architecture

### Directory Structure
```
backend/
├── src/
│   ├── app.ts              # Express app configuration
│   ├── server.ts           # HTTP server + Socket.IO setup
│   ├── routes/             # API route handlers
│   │   └── interview.routes.ts
│   ├── services/           # Business logic
│   │   ├── ai.service.ts
│   │   ├── question.service.ts
│   │   └── report.service.ts
│   ├── sockets/            # WebSocket handlers
│   │   └── interview.socket.ts
│   └── types/              # TypeScript type definitions
│       └── interview.types.ts
```

### Key Components

#### 1. Express Application (`app.ts`)
- Configures middleware (CORS, JSON parsing)
- Registers API routes
- Error handling middleware

#### 2. Server (`server.ts`)
- Creates HTTP server
- Initializes Socket.IO
- Starts listening on configured port

#### 3. Routes (`routes/interview.routes.ts`)
- `POST /api/interview/create` - Create new interview session
- `GET /api/interview/:sessionId` - Get session details
- `POST /api/interview/submit` - Submit code for evaluation
- `POST /api/interview/complete/:sessionId` - Complete interview

#### 4. Services

**AI Service** (`services/ai.service.ts`)
- Question generation using Groq / LLaMA 3.1
- Code evaluation with numeric scoring
- Verbal response generation
- Final feedback and report generation
- Interview feedback (strengths, weaknesses, recommendations)

**Question Service** (`services/question.service.ts`)
- Dynamic question generation via AI service
- Difficulty-based question creation

**Evaluation Service** (`services/evaluation.service.ts`)
- Answer evaluation orchestration
- Strict numeric scoring (0-100)
- Score validation and normalization
- Weighted scoring calculation

**Report Service** (`services/report.service.ts`)
- Report generation
- Score aggregation
- Strengths/weaknesses analysis

#### 5. WebSockets (`sockets/interview.socket.ts`)
- Real-time interview updates
- Answer submission events
- Question progression
- Interview completion notifications

## Frontend Architecture

### Directory Structure
```
frontend/
├── pages/
│   ├── index.tsx                    # Interview type selection
│   ├── interview/[sessionId].tsx    # Interview screen
│   └── report/[sessionId].tsx       # Report screen
├── components/
│   ├── AIAvatar.tsx                 # AI interviewer avatar
│   ├── CameraFeed.tsx               # Mandatory camera feed
│   ├── QuestionCard.tsx             # Question display
│   └── AnswerInput.tsx              # Voice + text input
└── styles/
    └── globals.css                   # Global styles
```

### Key Components

#### 1. Pages

**Home Page** (`pages/index.tsx`)
- Interview type selection
- Session creation
- Navigation to interview

**Interview Page** (`pages/interview/[sessionId].tsx`)
- Real-time interview interface
- Question progression
- Answer submission
- Socket.IO integration

**Report Page** (`pages/report/[sessionId].tsx`)
- Score visualization
- Detailed breakdowns
- Strengths/weaknesses display
- Recommendations

#### 2. Components

**AIAvatar** (`components/AIAvatar.tsx`)
- Visual representation of AI interviewer
- Speaking animation
- Status indicators

**CameraFeed** (`components/CameraFeed.tsx`)
- Mandatory camera access
- Real-time video feed
- Recording indicator
- Error handling

**QuestionCard** (`components/QuestionCard.tsx`)
- Question display
- Type and difficulty badges
- Timer display
- Score information

**AnswerInput** (`components/AnswerInput.tsx`)
- Text input area
- Voice recording (Web Speech API)
- Transcript display
- Submit functionality

## Data Flow

### Interview Creation Flow
1. User selects interview type
2. Frontend calls `POST /api/interview/create`
3. Backend generates questions
4. Session created and returned
5. Frontend navigates to interview page

### Answer Submission Flow
1. User provides answer (text/voice)
2. Frontend calls `POST /api/interview/submit-answer`
3. Backend evaluates answer using OpenAI
4. Score calculated with strict numeric logic
5. Score returned to frontend
6. Next question displayed or interview completed

### Report Generation Flow
1. Interview completed
2. Backend aggregates all scores
3. OpenAI generates strengths/weaknesses
4. Report created and stored
5. Frontend displays comprehensive report

## Scoring System

### Metrics (0-100 scale)
- **Correctness**: 30% weight
- **Completeness**: 20% weight
- **Clarity**: 15% weight
- **Technical Accuracy**: 25% weight
- **Communication**: 10% weight

### Calculation
```
Overall Score = Σ(metric_score × weight)
Final Score = min(Overall Score, maxScore)
```

## Technology Choices

### Backend
- **Express.js**: Lightweight, flexible web framework
- **TypeScript**: Type safety and better developer experience
- **Socket.IO**: Real-time bidirectional communication
- **Groq SDK**: LLaMA 3.1 integration via Groq API

### Frontend
- **Next.js**: React framework with SSR/SSG capabilities
- **TypeScript**: Type safety
- **Socket.IO Client**: Real-time updates
- **Web Speech API**: Browser-native speech recognition

## Security Considerations

- API keys stored in environment variables
- CORS configured for specific origins
- Input validation on all endpoints
- Camera permissions handled securely
- Session management (TODO: implement authentication)

## Scalability

- Stateless API design
- In-memory storage (TODO: migrate to database)
- Horizontal scaling ready
- WebSocket connection pooling
- Async processing for evaluations

## Future Enhancements

- Database integration (PostgreSQL/MongoDB)
- User authentication and authorization
- Interview recording and playback
- Advanced analytics dashboard
- Multi-language support
- Custom question sets
