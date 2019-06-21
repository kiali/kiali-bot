#!/bin/env bash

## SETUP SSH CLIENT
#
openssl aes-256-cbc -K $encrypted_a9e5b11a096a_key -iv $encrypted_a9e5b11a096a_iv \
  -in ./.travis/deploy-key.enc -out ./.travis/deploy-key -d
eval $(ssh-agent -s)
chmod 600 ./.travis/deploy-key
echo -e "\nHost $DEPLOY_SERVER\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
ssh-add -q ./.travis/deploy-key

# DEPLOY
#
npm pack
cat kiali-bot-0.2.0.tgz | ssh -q $DEPLOY_USER@$DEPLOY_SERVER
