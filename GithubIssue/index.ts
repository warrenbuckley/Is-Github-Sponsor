import { Context, HttpRequest } from "@azure/functions"
import { graphql } from "@octokit/graphql";

// Azure Function HTTP Trigger entry point
export default async function (context: Context, req: HttpRequest): Promise<void> {
  const userToken = (req.query.token || (req.body && req.body.token));
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${userToken}`,
    },
  });

  try {
    const data = await graphqlWithAuth(`{
        viewer {
          login
        }
      }`);

    console.log(data);
    context.res = {
        status: 200,
        body: data
    }
  }
  catch (error) {
    context.res = {
        status: error.status,
        body: error.message
    };
  }

  context.done();
}