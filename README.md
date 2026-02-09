# AI Interview Platform

A comprehensive AI-powered interview platform that conducts automated interviews using GPT-4, evaluates candidate responses with strict numeric scoring, and provides detailed feedback reports.

## Overview

This platform enables organizations to conduct automated technical, behavioral, and system design interviews. The system uses AI to generate questions, evaluate answers, and provide comprehensive scoring and feedback.

## Features

- **Multiple Interview Types**: Technical, Behavioral, System Design, and Mixed interviews
- **AI-Powered Question Generation**: Dynamic question generation using GPT-4
- **Real-time Evaluation**: Strict numeric scoring (0-100) across multiple metrics
- **Voice & Text Input**: Support for both voice and text-based answers
- **Mandatory Camera Feed**: Real-time video monitoring during interviews
- **Detailed Reports**: Comprehensive scoring breakdowns, strengths, weaknesses, and recommendations
- **WebSocket Support**: Real-time communication between frontend and backend

## Tech Stack

### Backend
- Express.js with TypeScript
- Socket.IO for real-time communication
- OpenAI GPT-4 for AI capabilities
- RESTful API architecture

### Frontend
- Next.js 14 with TypeScript
- React 18
- Socket.IO Client
- Web Speech API for voice input

## Project Structure

```
ai-interview-platform/
├── backend/          # Express + TypeScript backend
├── frontend/         # Next.js frontend
├── README.md         # This file
├── SETUP.md          # Setup instructions
├── ARCHITECTURE.md   # System architecture
└── PROJECT_SUMMARY.md # Feature summary
```

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Documentation

- [SETUP.md](./SETUP.md) - Installation and setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Feature overview and capabilities

## License

ISC
