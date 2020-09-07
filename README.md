# Is Github Sponsor (Azure Function)
An Azure Function that checks if a user is a sponsor of you.

This function could be used to help introduce some sponsorware to your software to remove sponsor messages or to add additional functionality for sponsors only.

It runs the following GraphQL query & returns a JSON result if the logged in GitHub user with a token sent to the API endpoint is a valid sponsor.

## Sponsorware
<a href="https://github.com/sponsors/warrenbuckley"><img src="https://github.githubassets.com/images/modules/site/sponsors/pixel-mona-heart.gif" align="left" height="45" /></a>
If you find it useful to yourself or your business then to check if you have a valid GitHub user as a sponsor then <a href="https://github.com/sponsors/warrenbuckley">I would love you to consider sponsoring me on Github</a> please

### Checks
✔️ Is it yourself ? <br/>
✔️ Is the user a member of an organisation - that you want to allow all members of to have access <br/>
✔️ Check all repos that the logged in user has contributed to see if they have contributed with a commit<br/>
✔️ Check all sponsors of the logged in user to see if they are an active sponsor <br/>

### Example Request URL
https://warren-buckley.co.uk/IsActiveSponsor?token=GH_TOKEN

### GraphQL
```json{
    viewer {
        login
        organization(login: "umbraco") {
            viewerIsAMember
        }
        repositoriesContributedTo(first: 100, contributionTypes:[COMMIT, PULL_REQUEST], after: "") {
            nodes {
                name
                nameWithOwner
            }
            pageInfo {
                hasNextPage
                endCursor
            }
            totalCount
        }
        sponsorshipsAsSponsor(first: 100, after: "") {
            nodes {
                sponsorable {
                    __typename
                    ... on User {
                        login
                        name
                    }
                }
            }
            pageInfo {
                hasNextPage
                endCursor
            }
            totalCount
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
|GITHUB_REPO_HAS_CONTRIBS|A Github repo to check if the user has made a contribution to verify as being a valid sponsor|warrenbuckley/iis-express-code


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

