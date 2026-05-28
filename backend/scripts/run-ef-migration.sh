#!/bin/bash
# Helper script for running dotnet ef commands with required environment variables
# Usage: ./run-ef-migration.sh <migration-name>
set -e

POSTGRES_PASSWORD=fitness_dev_password \
MONGO_PASSWORD=mongo_dev_password \
ASPNETCORE_ENVIRONMENT=Local \
dotnet ef "$@"
