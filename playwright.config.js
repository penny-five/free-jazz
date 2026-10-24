import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',use:{headless:true,launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']}},webServer:{command:'npm run dev -- --port 5173',url:'http://localhost:5173',reuseExistingServer:true}});
