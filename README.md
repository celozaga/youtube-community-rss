# YouTube Community RSS

A simplified RSS generator for YouTube Community posts (Formerly known as YouTube Posts), designed to be hosted on Vercel.

> [!NOTE]
> This RSS feed only captures posts from the channel's author, not from the entire community.

## Deployment on Vercel

1.  Push this folder to a GitHub repository.
2.  Import the project into Vercel.
3.  Vercel should automatically detect it as a Node.js project (or generic).
4.  Deploy.

## Usage

Once deployed, you can access the RSS feed via:

`https://your-project.vercel.app/api?handle=@YourChannelHandle`

or using the Channel ID:

`https://your-project.vercel.app/api?handle=UCxxxxxxxxxxxx`

## Local Development

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run locally:
    ```bash
    npm run dev
    ```
    This requires the Vercel CLI.
