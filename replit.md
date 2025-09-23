# Overview

BioPredict is a molecular bioactivity prediction platform that uses machine learning to predict the biological activity (pIC50) of chemical compounds and assess their safety profile. The application allows users to input molecular structures via SMILES notation and receives comprehensive analysis including molecular descriptors, safety assessments, and bioactivity predictions.

The system is built as a full-stack web application with a React frontend and Express.js backend, featuring a clean molecular visualization interface and comprehensive analysis dashboard.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API with JSON responses
- **Request Processing**: Express middleware for JSON parsing and request logging
- **Error Handling**: Centralized error handling middleware

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Development Storage**: In-memory storage implementation for rapid development
- **Connection**: Database connection pooling via Neon serverless driver

## Core Business Logic
- **Molecular Calculations**: Custom molecular descriptor calculator for SMILES processing
- **ML Prediction Service**: Mock machine learning models for pIC50 prediction and safety assessment
- **Data Models**: Compounds, predictions, and batch jobs with full type safety
- **Validation**: Zod schemas for runtime validation and type generation

## Authentication and Authorization
- **Session Management**: Connect-PG-Simple for PostgreSQL-backed sessions
- **Security**: CORS configuration and secure cookie settings
- Currently implements basic session infrastructure without user authentication

## Development and Build Process
- **Development Server**: Vite dev server with HMR integration
- **Production Build**: ESBuild for server bundling, Vite for client assets
- **Type Safety**: Shared TypeScript types between frontend and backend
- **Code Quality**: ESLint and TypeScript strict mode enforcement

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe SQL toolkit and query builder
- **Connect-PG-Simple**: PostgreSQL session store for Express sessions

## UI and Styling
- **Radix UI**: Headless UI components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography
- **Embla Carousel**: Carousel component for image galleries

## Development Tools
- **Replit Integration**: Vite plugins for Replit-specific development features
- **TanStack Query**: Powerful data synchronization for React applications
- **React Hook Form**: Performant forms with easy validation
- **Date-fns**: Modern JavaScript date utility library

## Molecular Computing
- **SMILES Processing**: Custom implementation for molecular structure parsing
- **Descriptor Calculation**: In-house algorithms for molecular property computation
- **Safety Assessment**: Mock ML models for toxicity and safety predictions
- Note: Production systems would integrate with RDKit-JS for accurate molecular calculations

## Build and Deployment
- **Vite**: Fast build tool with TypeScript and React support
- **ESBuild**: JavaScript bundler for server-side code
- **PostCSS**: CSS processing with Tailwind CSS integration
- **TypeScript**: Full-stack type safety and development experience