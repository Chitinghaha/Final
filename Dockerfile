# Final/Dockerfile

# 1. 選 Node.js 官方映像作為基底
FROM node:18-alpine

# 2. 設定工作目錄為 /usr/src
WORKDIR /usr/src

# 3. 複製根目錄的 package.json（裡面含 "type":"module"）
#    讓 /usr/src 有一份 package.json，確保子資料夾的 .js 都會被當 ESM 解析
COPY . .
# COPY ./demo/api/package.json ./

# （可選）如果有 lock 檔也一起複製
# COPY package-lock.json ./

# 4. 複製 IAM 核心程式碼到 /usr/src/src
# COPY src ./src

# 5. 複製 demo/api 底下的所有檔案到 /usr/src/app
# COPY demo/api ./app

# 6. 切換到 /usr/src/app，並安裝 API 依賴套件
WORKDIR /usr/src/demo/api
RUN npm install

# 7. 暴露 3000 埠
EXPOSE 3000

# 8. 容器啟動時執行 npm start（也就是執行 node server.js）
CMD ["npm", "start"]
