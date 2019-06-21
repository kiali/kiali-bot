#!/bin/env bash

## SETUP SSH CLIENT
#
eval $(ssh-agent -s)
chmod 600 ./.travis/deploy-key
echo -e "\nHost $DEPLOY_SERVER\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
ssh-add ./.travis/deploy-key

# DEPLOY
#
npm pack
cat kiali-bot-0.2.0.tgz | ssh -q $DEPLOY_USER@$DEPLOY_SERVER
