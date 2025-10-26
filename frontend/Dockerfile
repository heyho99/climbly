# Stage 1: build static (今回は静的資産のみなのでコピーのみ)
FROM nginx:1.27-alpine

# curlをインストール
RUN apk add --no-cache curl

# アプリ静的ファイル
COPY ./ /usr/share/nginx/html/
# Nginx 設定
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# 健康チェックをcurlで行う
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]