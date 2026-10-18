# Overview

UniRide is a university-specific rideshare platform designed for student safety and community building. The application connects verified students for trusted ride sharing with features like safety verification, rating systems, and real-time messaging. It's built as a full-stack web application with a React frontend and Express.js backend, focusing on creating a secure environment for campus transportation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with React and TypeScript using Vite as the build tool. It follows a component-based architecture with:

- **UI Framework**: Built with shadcn/ui components and Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Routing**: Client-side routing using Wouter for lightweight navigation
- **State Management**: React Query (@tanstack/react-query) for server state management and caching
- **Form Handling**: React Hook Form with Zod validation schemas for type-safe forms
- **Authentication**: JWT token-based authentication with localStorage persistence

The application is structured with clear separation of concerns:
- Pages for route components
- Reusable UI components in the components directory
- Custom hooks for shared logic
- Utility libraries for common functions

## Backend Architecture

The backend uses Express.js with TypeScript in ESM module format:

- **API Design**: RESTful API with organized route handlers
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Data Storage**: Abstracted storage interface allowing for multiple implementations (currently in-memory, designed for database integration)
- **Middleware**: Custom logging and error handling middleware
- **Development Setup**: Integrated with Vite for hot reloading and development server

The server implements a clean architecture with:
- Route handlers separated from business logic
- Storage abstraction layer for data operations
- Type-safe schemas shared between frontend and backend

## Data Storage Solutions

The application uses a flexible storage architecture:

- **ORM**: Drizzle ORM configured for PostgreSQL with migration support
- **Database**: Neon Database (serverless PostgreSQL) for production
- **Schema Definition**: Shared TypeScript schemas using Drizzle and Zod for validation
- **Development Storage**: In-memory storage implementation for development and testing

Key data models include:
- Users with verification status and ratings
- Rides with driver information and availability
- Ride requests with approval workflow
- Messages for user communication
- Ratings for trust building

## Authentication and Authorization

Security-first approach with:

- **University Verification**: Email-based verification system for .edu addresses
- **JWT Tokens**: Stateless authentication with secure token handling
- **Password Security**: Bcrypt hashing for password storage
- **Route Protection**: Middleware-based authentication checks
- **Session Management**: Client-side token storage with automatic cleanup

## External Dependencies

- **Neon Database**: Serverless PostgreSQL database service for data persistence
- **Radix UI**: Headless UI components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Query**: Server state management and caching library
- **Drizzle ORM**: Type-safe database operations and migrations
- **Zod**: Runtime type validation for forms and API data
- **Bcrypt**: Password hashing for security
- **JWT**: Token-based authentication
- **Vite**: Build tool and development server
- **Wouter**: Lightweight client-side routing

The application is designed to run on Replit with specific configurations for the development environment, including banner integration and runtime error handling.