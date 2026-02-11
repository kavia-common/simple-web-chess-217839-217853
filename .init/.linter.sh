#!/bin/bash
cd /home/kavia/workspace/code-generation/simple-web-chess-217839-217853/react_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

