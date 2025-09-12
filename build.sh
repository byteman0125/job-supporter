#!/bin/bash

echo "🚀 Building Code Supporter Applications..."

# Build Tester App
echo "📦 Building Tester App..."
cd tester
npm run build:win
if [ $? -eq 0 ]; then
    echo "✅ Tester app built successfully!"
else
    echo "❌ Failed to build Tester app"
    exit 1
fi

cd ..

# Build Supporter App
echo "📦 Building Supporter App..."
cd supporter
npm run build:win
if [ $? -eq 0 ]; then
    echo "✅ Supporter app built successfully!"
else
    echo "❌ Failed to build Supporter app"
    exit 1
fi

cd ..

echo "🎉 All applications built successfully!"
echo "📁 Executables are in:"
echo "   - tester/dist/"
echo "   - supporter/dist/"
