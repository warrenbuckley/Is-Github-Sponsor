# Is Github Sponsor (Azure Function)
An Azure Function that checks if a user is a sponsor of you.

This function could be used to help introduce some sponsorware to your software to remove sponsor messages or to add additional functionality for sponsors only.

It runs the following GraphQL query & returns a JSON result if the logged in GitHub user with a token sent to the API endpoint is a valid sponsor.

### Checks 
✔️ Is it yourself ? <br/>
✔️ Is the user a member of an organisation - that you want to allow all members of to have access <br/>
✔️ Check all sponsors of the logged in user to see if they are an active sponsor <br/>


### GraphQL
```json{
    viewer {
        login
        organization(login: "umbraco") {
            viewerIsAMember
        }
        sponsorshipsAsSponsor(first: 100, after: "") {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                sponsorable {
                    __typename
                    ... on User {
                        login
                        name
                    }
                }
            }
        }
    }
}
```



### Response
```json
{
  "validSponsor": true
}
```

### Environment Variables / AppSettings

Set the following AppSetting keys in the Azure portal for this function or local.settings.json file at the root if you wish to run & debug locally.

| AppSetting Key | Value | Example
|----------------|-------|--------
|GITHUB_SPONSOR_USER_TO_VERIFY|The username on GitHub you wish to check if the current logged in user is a sponsoring|warrenbuckley
|GITHUB_ORG_TO_VERIFY|A Github organization username you wish to allow all members of to be valid sponsors|umbraco


#### local.settings.json
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "GITHUB_SPONSOR_USER_TO_VERIFY": "warrenbuckley",
    "GITHUB_ORG_TO_VERIFY": "umbraco"
  }
}
```

### Are you using this?
If you are using this Azure Function in the wild to help support any sponsorship workflows, I would be interested to hear about it & would like to drop in a hint that it may be nice to sponsor me for creating this handy little Azure Function
