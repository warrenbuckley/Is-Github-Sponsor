import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { graphql } from "@octokit/graphql";
import { GraphQlQueryResponseData } from "@octokit/graphql/dist-types/types";

// Our own TypeScript interfaces to help make type checking etc a little nicer
interface GithubSponsor {
  name:string;
  login:string;
}

// Azure Function HTTP Trigger entry point
const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {

    // The user to check if they are sponsoring
    const userToCheck = process.env.GITHUB_SPONSOR_USER_TO_VERIFY;

    // The organization that a user can be a member of
    // You may want a company/org who can get access without being a sponsor
    const orgToCheck = process.env.GITHUB_ORG_TO_VERIFY;

    if(userToCheck === undefined || orgToCheck === undefined){
      context.res = {
        status: 400,
        body: "Please ensure environment variables 'GITHUB_SPONSOR_USER_TO_VERIFY' & 'GITHUB_ORG_TO_VERIFY' are set"
      };
      context.done();
    }

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
      let hasMorePages:boolean = false;
      let pageCursor:string = "";

      let login:string = "";
      let isOrgMember:boolean = false;

      do {
        const graphql:GraphQlQueryResponseData = await graphqlWithAuth(`
        {
            viewer {
              login
              organization(login: "${orgToCheck}") {
                viewerIsAMember
              }
              sponsorshipsAsSponsor(first: 100, after: "${pageCursor}") {
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
        `);

        // Who is this ?
        login = graphql.viewer.login;
        isOrgMember = graphql.viewer.organization.viewerIsAMember;

        // Set some logging - so we have some common properties for all log messages sent
        context.traceContext.attributes["githubUser"] = login;
        context.traceContext.attributes["githubUserIsInOrg"] = isOrgMember.toString();

        // Add all sponsors to the array
        graphql.viewer.sponsorshipsAsSponsor.nodes.forEach(sponsor => {
          sponsors.push({
            name: sponsor.sponsorable.name,
            login: sponsor.sponsorable.login
          })
        });

        // Check if the response tells us it has more pages to fetch
        hasMorePages = graphql.viewer.sponsorshipsAsSponsor.pageInfo.hasNextPage;
        pageCursor = graphql.viewer.sponsorshipsAsSponsor.pageInfo.endCursor;

      } while (hasMorePages);

      let isSponsor = false;

      // Is the user yourself ?
      const isYourself = login.toLocaleLowerCase() === userToCheck;
      if(isYourself){
        context.log.info(`The user ${login} is yourself`);
        isSponsor = true;
      }

      // Is the user a member of the Umbraco org ?
      else if(isOrgMember) {
        context.log.info(`The user ${login} is a member of the Org`);
        isSponsor = true;
      }

      // Does the list of all sponsors contain 'Warrenbuckley' ?
      else {
        context.log.info(`The user ${login} is sponsoring ${sponsors.length} people`);
        isSponsor = sponsors.findIndex(sponsor => sponsor.login === userToCheck) > 0;
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