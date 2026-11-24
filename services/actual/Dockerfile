# syntax=docker/dockerfile:1
#
# Actual Budget sync server 26.11.0 for Railway.
#
# Base: the official image (Debian bookworm-slim, Node 24), pinned by digest
# (tag 26.11.0, pushed 2026-11-02). To upgrade, change the tag and digest
# together (Docker Hub, actualbudget/actual-server) and redeploy.
#
# Added on top: a start script that sets the server password from the
# ACTUAL_PASSWORD variable before the public port opens, so nobody can claim
# a fresh server through the "set a password" page.
FROM actualbudget/actual-server:26.11.0@sha256:06cf186569cf58d93e12659ff1a517b65b5b0ebee7050a3991d4bd8a1d398da6

COPY --chmod=0755 railway-start.sh /railway/railway-start.sh
COPY --chmod=0644 railway-password.mjs /railway/railway-password.mjs

ENV ACTUAL_DATA_DIR=/data \
    TINI_SUBREAPER=1 \
    ACTUAL_LOGIN_METHOD=password \
    ACTUAL_ALLOWED_LOGIN_METHODS=password,openid \
    PORT=5006

WORKDIR /app
EXPOSE 5006
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/railway/railway-start.sh"]
