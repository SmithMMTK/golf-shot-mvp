### Minor change
```bash
git add .
git commit -m "update"
git push
npm run deploy
```

### Big change
```bash
rm -rf dist
npm run build
npm run deploy
```