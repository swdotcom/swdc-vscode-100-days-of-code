import axios from "axios";
import { api_endpoint, zoom_api_endpoint } from "../utils/Constants";
import { getItem, setItem } from "../utils/Util";
import { access } from "fs";

const querystring = require("querystring");

// build the axios api base url
const beApi = axios.create({
    baseURL: `${api_endpoint}`
});

const zoomApi = axios.create({
    baseURL: `${zoom_api_endpoint}`
});

export async function serverIsAvailable() {
    return await softwareGet("/ping")
        .then(result => {
            return isResponseOk(result);
        })
        .catch((e: any) => {
            return false;
        });
}

/**
 * Response returns a paylod with the following...
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
export async function softwareGet(
    api: string,
    jwt: string = "",
    additionHeaders: any = {}
) {
    if (jwt) {
        beApi.defaults.headers.common["Authorization"] = jwt;
    }

    if (additionHeaders && Object.keys(additionHeaders).length) {
        // add the additional headers
        beApi.defaults.headers.common = {
            ...beApi.defaults.headers.common,
            ...additionHeaders
        };
    }

    return await beApi.get(api).catch(err => {
        console.log(`error fetching data for ${api}, message: ${err.message}`);
        return err;
    });
}

/**
 * perform a put request
 */
export async function softwarePut(api: string, payload: any, jwt: string) {
    // PUT the kpm to the PluginManager
    beApi.defaults.headers.common["Authorization"] = jwt;

    return await beApi
        .put(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
}

/**
 * perform a post request
 */
export async function softwarePost(api: string, payload: any, jwt: string) {
    // POST the kpm to the PluginManager
    beApi.defaults.headers.common["Authorization"] = jwt;
    return beApi
        .post(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
}

/**
 * perform a delete request
 */
export async function softwareDelete(api: string, jwt: string) {
    beApi.defaults.headers.common["Authorization"] = jwt;
    return beApi
        .delete(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `error with delete request for ${api}, message: ${err.message}`
            );
            return err;
        });
}

/**
 * Check if the spotify response has an expired token
 * {"error": {"status": 401, "message": "The access token expired"}}
 */
export function hasTokenExpired(resp: any) {
    // when a token expires, we'll get the following error data
    // err.response.status === 401
    // err.response.statusText = "Unauthorized"
    if (
        resp &&
        resp.response &&
        resp.response.status &&
        resp.response.status === 401
    ) {
        return true;
    }
    return false;
}

/**
 * check if the reponse is ok or not
 * axios always sends the following
 * status:200
 * statusText:"OK"
 * 
    code:"ENOTFOUND"
    config:Object {adapter: , transformRequest: Object, transformResponse: Object, …}
    errno:"ENOTFOUND"
    host:"api.spotify.com"
    hostname:"api.spotify.com"
    message:"getaddrinfo ENOTFOUND api.spotify.com api.spotify.com:443"
    port:443
 */
export function isResponseOk(resp: any) {
    let status = getResponseStatus(resp);
    if (status && resp && status < 300) {
        return true;
    }
    return false;
}

/**
 * get the response http status code
 * axios always sends the following
 * status:200
 * statusText:"OK"
 */
function getResponseStatus(resp: any) {
    let status = null;
    if (resp && resp.status) {
        status = resp.status;
    } else if (resp && resp.response && resp.response.status) {
        status = resp.response.status;
    }
    return status;
}

export async function zoomGet(api: string, params: any = {}) {
    const access_token = getItem("zoom_access_token");

    zoomApi.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

    if (params && Object.keys(params).length) {
        const qryStr = querystring.stringify(params);
        api = `${api}?${qryStr}`;
    }

    const resultData = await zoomApi
        .get(api)
        .then(resp => {
            return { status: "success", data: resp.data };
        })
        .catch(e => {
            console.log("Error retrieving Zoom data: ", e.message);
            return { status: "failed", error: e, data: null };
        });
    return resultData;
}

export async function zoomPost(api: string, payload: any, tries: number = 0) {
    const access_token = getItem("zoom_access_token");

    zoomApi.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

    const resultData: any = await zoomApi
        .post(api, payload)
        .then(resp => {
            return { status: "success", data: resp.data };
        })
        .catch(async e => {
            if (e.response && e.response.status === 401 && tries < 1) {
                // refresh the access token and try again
                const refreshResult = await softwarePost(
                    "/auth/zoom/refreshAccessToken",
                    {},
                    getItem("jwt")
                );
                if (refreshResult && refreshResult.data) {
                    const accessTokenInfo = refreshResult.data;
                    setItem("zoom_access_token", accessTokenInfo.access_token);
                    setItem(
                        "zoom_refresh_token",
                        accessTokenInfo.refresh_token
                    );
                    tries += 1;
                    return zoomPost(api, payload, tries);
                }
            }
            console.log("Error creating Zoom data: ", e.message);
            return { status: "failed", error: e, data: null };
        });
    return resultData;
}
