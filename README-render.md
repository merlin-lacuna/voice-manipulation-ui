# Voice Manipulation UI - Render.com Deployment

This project has been configured to run on Render.com as a single Docker container with Nginx as a proxy to route traffic between the frontend and backend services.

## Deployment Architecture

The setup uses:
- A single Docker container that runs:
  - FastAPI backend on port 8000
  - Next.js frontend on port 3000
  - Nginx proxy on port 10000 (the port Render.com exposes)

The Nginx proxy routes requests:
- `/api/*`, `/spectrograms/*`, `/processed/*` → Backend API
- `/debug` → Backend API
- All other paths → Frontend

## Deployment Files

- `Dockerfile.combined` - The main Dockerfile that builds both services and the Nginx proxy
- `nginx.conf` - Nginx configuration that routes requests to the appropriate service
- `render.yaml` - Render Blueprint file that configures the service
- `.env.production` - Environment variables for production deployment

## Local Testing

To test the Render.com setup locally:

```bash
# Make the script executable
chmod +x start-render.sh

# Run the local Render.com simulation
./start-render.sh
```

Then visit http://localhost:10000 to see the application running with the same configuration as it would on Render.com.

## Deployment to Render.com

1. Push your code to GitHub
2. In Render.com dashboard:
   - Create a new Web Service
   - Connect your GitHub repository
   - Select "Docker" as the environment
   - Choose "Dockerfile.combined" as the Docker file
   - Set the environment variables as needed

Or use the Render Blueprint by clicking the "Deploy to Render" button or by using the `render.yaml` file directly.

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Should be empty for production to use relative URLs
- `API_HOST` - Set to 0.0.0.0 to listen on all interfaces
- `API_PORT` - Set to 8000 for the backend API
- `PORT` - Set to 10000 for the Nginx proxy (Render.com handles this automatically)

## Disk Storage

The `render.yaml` defines a persistent disk mount for the `/app/api/voices` directory to store voice files.