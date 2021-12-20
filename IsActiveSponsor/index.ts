import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { graphql } from "@octokit/graphql";
import { GraphQlQueryResponseData } from "@octokit/graphql/dist-types/types";

// Our own TypeScript interfaces to help make type checking etc a little nicer
interface GithubSponsor {
  name:string;
  login:string;
}

interface GithubRepo {
  name:string;
  nameWithOwner:string;
}

// Azure Function HTTP Trigger entry point
const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {

    // The user to check if they are sponsoring
    const userToCheck = process.env.GITHUB_SPONSOR_USER_TO_VERIFY;

    // The organization that a user can be a member of
    // You may want a company/org who can get access without being a sponsor
    const orgToCheck = process.env.GITHUB_ORG_TO_VERIFY;

    // The repo with the owner such as 'warrenbuckley/iis-express-code'
    // This is used to check if the logged in GitHub user has made a contribution to the repo
    const repoToCheckForContribs = process.env.GITHUB_REPO_HAS_CONTRIBS;

    // An env variable that are comma separated list of GitHub users to bypass the sponsorware check and give access
    let bypassedUserList = process.env.GITHUB_BYPASSED_USERS;

    if(userToCheck === undefined || orgToCheck === undefined || repoToCheckForContribs === undefined || bypassedUserList === undefined){
      context.res = {
        status: 400,
        body: "Please ensure environment variables 'GITHUB_SPONSOR_USER_TO_VERIFY' & 'GITHUB_ORG_TO_VERIFY' & 'GITHUB_REPO_HAS_CONTRIBS' & 'GITHUB_BYPASSED_USERS' are set"
      };
      context.done();
    }

    // Split the CSV string into a proper array of strings
    let bypassedUsers = bypassedUserList.split(",");

    // Get user token from the HTTP POST or GET
    const userToken = (req.query.token || (req.body && req.body.token));
    if(userToken === undefined || userToken === null){
      context.res = {
        status: 400,
        body: "Please pass a 'token' on the query string or in the request body"
      };
      context.done();
    }

    const graphqlWithAuth = graphql.defaults({
        headers: {
          authorization: `token ${userToken}`,
        },
      });

    try {
      let sponsors:Array<GithubSponsor> = [];
      let hasMoreSponsorPages:boolean = false;
      let sponsorPageCursor:string = "";
      let totalSponsors:number;

      let repos:Array<GithubRepo> = [];
      let hasMoreRepoPages:boolean = false;
      let repoPageCursor:string = "";
      let totalRepos:number;


      let login:string = "";
      let isOrgMember:boolean = false;

      let rawQuery:string = `
      query isUserASponsor($afterRepo: String, $afterSponsor: String, $orgToCheck: String!) {
        viewer {
          login
          organization(login: $orgToCheck) {
            viewerIsAMember
          }
          repositoriesContributedTo(first: 100, after: $afterRepo, contributionTypes: [COMMIT]) {
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
          sponsorshipsAsSponsor(first: 100, after: $afterSponsor) {
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
      }`;

      // Variables object to use in GraphQl query
      // We always need to send the orgToCheck variable to our query as its non nullable
      let variables:any = {
        orgToCheck: orgToCheck
      };

      do {
        // For first query we do not need to send page cursors in
        if(sponsorPageCursor){
          variables.afterSponsor = sponsorPageCursor;
        }
        if(repoPageCursor){
          variables.afterRepo = repoPageCursor;
        }

        // Go send the query to GitHub GraphQL
        const query:GraphQlQueryResponseData = await graphqlWithAuth(rawQuery, variables);

        // Who is this ?
        login = query.viewer.login;

        // If the org does not exist then the viewerIsAMember can be null
        isOrgMember = query.viewer.organization?.viewerIsAMember ? query.viewer.organization?.viewerIsAMember : false;

        // Add all sponsors to the array
        query.viewer.sponsorshipsAsSponsor.nodes.forEach(sponsor => {
          // Ensure unique items added to array only
          const tryFindSponsor = sponsors.findIndex(x => x.name === sponsor.sponsorable.name && x.login === sponsor.sponsorable.login);
          if(tryFindSponsor === -1){
            sponsors.push({
              name: sponsor.sponsorable.name,
              login: sponsor.sponsorable.login
            });
          }
        });

        // Add all repos to the array
        query.viewer.repositoriesContributedTo.nodes.forEach(repo => {
          // Ensure unique items added to array only
          const tryFindRepo = repos.findIndex(x => x.name === repo.name && x.nameWithOwner === repo.nameWithOwner);
          if(tryFindRepo === -1){
            repos.push({
              name: repo.name,
              nameWithOwner: repo.nameWithOwner
            });
          }
        });

        // Check if the response tells us it has more pages to fetch
        hasMoreSponsorPages = query.viewer.sponsorshipsAsSponsor.pageInfo.hasNextPage;
        sponsorPageCursor = query.viewer.sponsorshipsAsSponsor.pageInfo.endCursor;
        totalSponsors = query.viewer.sponsorshipsAsSponsor.totalCount;

        hasMoreRepoPages = query.viewer.repositoriesContributedTo.pageInfo.hasNextPage;
        repoPageCursor = query.viewer.repositoriesContributedTo.pageInfo.endCursor;
        totalRepos = query.viewer.repositoriesContributedTo.totalCount;

      } while (hasMoreSponsorPages || hasMoreRepoPages);

      let isSponsor = false;

      // Verify totals
      if(sponsors.length !== totalSponsors){
        context.log.warn("The number of sponsors in the array does not match the total expected from query");
      }

      if(repos.length !== totalRepos){
        context.log.warn("The number of repos in the array does not match the total expected from query");
      }

      // Check for bypassed users
      let isBypassedUser = bypassedUsers.findIndex(user => user.toLocaleLowerCase() === login.toLocaleLowerCase()) > 0;

      // Is the user yourself ?
      const isYourself = login.toLocaleLowerCase() === userToCheck;
      if(isYourself){
        context.log.info(`The user ${login} is yourself`);
        isSponsor = true;
      }

      else if(isBypassedUser){
        context.log.info(`The user ${login} is in the list of bypassed users`);
        isSponsor = true;
      }

      // Is the user a member of the Umbraco org ?
      else if(isOrgMember) {
        context.log.info(`The user ${login} is a member of the Org`);
        isSponsor = true;
      }

      // Does the list of contrib repos contain our repo ?
      else if(repos.findIndex(repo => repo.nameWithOwner.toLocaleLowerCase() === repoToCheckForContribs) > 0) {
        context.log.info(`The user ${login} has made a commit contrib to ${repoToCheckForContribs}`);
        isSponsor = true;
      }

      // Does the list of all sponsors contain 'Warrenbuckley' ?
      else {
        context.log.info(`The user ${login} is sponsoring ${sponsors.length} people`);
        isSponsor = sponsors.findIndex(sponsor => sponsor.login.toLocaleLowerCase() === userToCheck) > 0;
      }

      context.res = {
        status: 200,
        body: { validSponsor: isSponsor }
      }

    } catch (error) {
        context.log.error("Request failed:", error.request);
        context.log.error("Error Mesage from GraphQL", error.message);

        context.res = {
            status: 400,
            body: `Looking up your sponsorship from GitHub GraphQL returned this error message: ${error.message}`
        };
    }

    context.done();
};

export default httpTrigger;