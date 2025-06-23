# Zoho CRM to Trello Integration

This script automates the creation of Trello boards from deals in Zoho CRM. It periodically checks for new deals that meet specific criteria and creates a corresponding Trello board for them.

## Setup Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Kerolos-George/zoho-trello-integration.git
    cd zoho-trello-integration
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file** in the root of the project and add the following environment variables. You can copy `.env.example` to create this file.

    ```
    # Zoho CRM Configuration
    ZOHO_CLIENT_ID=
    ZOHO_CLIENT_SECRET=
    ZOHO_REDIRECT_URI=http://localhost:3000/callback
    ZOHO_REFRESH_TOKEN=
    ZOHO_API_BASE_URL=https://www.zohoapis.com/crm/v2
    # Trello Configuration
    TRELLO_API_KEY=
    TRELLO_TOKEN=
    TRELLO_API_BASE_URL=https://api.trello.com/1

    # Application Configuration
    PORT=3000
    POLLING_INTERVAL=300000
    LOG_LEVEL=info

    ```

4.  **Obtain Zoho Credentials:**
    *   You will need to create a new client in the [Zoho API Console](https://api-console.zoho.com/) to get your `ZOHO_CLIENT_ID` and `ZOHO_CLIENT_SECRET`.
   
    *   To get the `ZOHO_REFRESH_TOKEN`, you will need to go through the OAuth2 flow:

        1. Open the following URL in your browser (replace `{client_id}` with your actual client ID):

           ```
           https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.deals.ALL,ZohoCRM.coql.READ&client_id={client_id}&response_type=code&access_type=offline&redirect_uri=http://localhost:3000/callback
           ```

        2. Authorize the app and you will be redirected to your redirect URI with a `code` parameter in the URL.

        3. Use the code from the URL in the following curl command to exchange it for a refresh token (replace `{client_id}`, `{client_secret}`, and `{code}` with your actual values):

           ```powershell
           curl -Method POST "https://accounts.zoho.com/oauth/v2/token" `
                -Body "client_id={client_id}&client_secret={client_secret}&redirect_uri=http://localhost:3000/callback&code={code}&grant_type=authorization_code" `
                -ContentType "application/x-www-form-urlencoded"
           ```

        4. The response will include your `refresh_token`. Use this value for `ZOHO_REFRESH_TOKEN` in your `.env` file.

5.  **Obtain Trello Credentials:**
    *   Get your `TRELLO_API_KEY` from [https://trello.com/app-key](https://trello.com/app-key).
    *   You can manually generate a `TRELLO_API_TOKEN` from the same page.


## How to run your script

To start the integration service, run the following command:

```bash
npm start
```

This will start the script, which runs on a schedule . By default, it runs every 10 seconds.

The script will look for deals in Zoho CRM that have:
*   **Deal Stage** = `Project Kickoff`
*   **Deal Type** = `New Implementation Project`

For each eligible deal, it will create a new Trello board and update the deal in Zoho with the Trello board's ID.

## Notes or known issues

*   **Zoho Custom Field:** The integration requires a custom field to be present in the "Deals" module in Zoho CRM to store the Trello Board ID.
    *   **Field Label:** `Project_Board_ID__c`
    *   When you create this custom field in Zoho, the **API Name** for it will be automatically set to `Project_Board_ID_c` (without the trailing `__c`). The script expects this exact API name. The script attempts to create this field if it doesn't exist, but it's good practice to verify it's been created correctly.

*   **Error Handling:** The script includes logging to `logs/application.log` and `logs/integration.log`. Check these files for any errors during execution. 