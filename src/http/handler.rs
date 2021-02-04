use std::sync::Arc;
use tokio::sync::Mutex;
use crate::{
    store::{ClientStore, RetrieverStore},
    config::{ClientConfig, RetrieverConfig},
    threads::Executor,
    client::{Client, Retriever},
    message::SendMessage,
};
use anyhow::Result;
use hyper::{Body, Request, Response, StatusCode, header::CONTENT_TYPE};
use iota_streams::core::prelude::HashMap;

pub async fn preflight_response(
) -> Result<Response<Body>> {
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE")
        .header("Access-Control-Allow-Headers", "*")
        .body(Body::from("OK"))
        .unwrap())
}

pub async fn spawn_oracle(
    req: Request<Body>,
    client_store: Arc<Mutex<ClientStore>>,
    executor: Arc<Mutex<Executor>>
) -> Result<Response<Body>> {
    let req_data = hyper::body::to_bytes(req.into_body()).await.unwrap();
    let response;
    let config: serde_json::Result<ClientConfig> = serde_json::from_slice(&req_data);
    match config {
        Ok(config) => {
            let id = config.node_config.id.as_bytes().to_vec();
            let req = config.get_request_input();
            let has_req = req.is_some();

            let client = Client::new(config)?;
            let addr = client.get_ann_link().clone();
            let pk = client.get_pk();

            client_store.lock().await.add_client(id.clone(), client)?;

            if has_req {
                Executor::spawn_requester(executor.clone(), id, req.unwrap())?;
            }

            let message = format!("pk: {}, addr: {}", pk, addr.to_string());
            response = respond(StatusCode::OK, message)?
        },
        Err(e) => {
            let error_message = format!("Malformed Json request: {}", e);
            response = respond(StatusCode::BAD_REQUEST, error_message)?;
        }
    }
    Ok(response)
}


pub async fn get_channel_id(
    req: Request<Body>,
    client_store: Arc<Mutex<ClientStore>>
) -> Result<Response<Body>> {
    let response;
    let params: HashMap<String, String> = req.uri().query().map(|v|{
        url::form_urlencoded::parse(v.as_bytes()).into_owned().collect()
    }).unwrap_or_else(|| HashMap::new());

    match params.get("id") {
        Some(id) => {
            let mut clients = client_store.lock().await;
            match clients.get_client(id.as_bytes()) {
                Some(client) => {
                    response = respond(StatusCode::ACCEPTED, client.ann_link.to_string())?;
                },
                None => {
                    response = respond(StatusCode::NOT_FOUND, "Referenced client was not found".to_string())?;
                }
            }
        },
        None => {
            let error_message = format!("Malformed request, missing id");
            response = respond(StatusCode::BAD_REQUEST, error_message)?;
        }
    }
    Ok(response)
}


pub async fn attach_message(
    req: Request<Body>,
    client_store: Arc<Mutex<ClientStore>>,
    addr: &str
) -> Result<Response<Body>> {
    let req_data = hyper::body::to_bytes(req.into_body()).await.unwrap();
    let response;

    let req_struct: serde_json::Result<SendMessage> = serde_json::from_slice(&req_data);
    match req_struct {
        Ok(msg) => {
            let mut clients = client_store.lock().await;
            match clients.get_client(&msg.id.as_bytes().to_vec()) {
                Some(client) => {
                    if client.is_whitelisted(addr) {
                        let msg = msg.get_message();
                        client.add_message(&msg).unwrap();
                        response = respond(StatusCode::ACCEPTED, "Message added to oracle".to_string())?;
                    } else {
                        response = respond(StatusCode::UNAUTHORIZED, "Not authorized to attach to oracle".to_string())?;
                    }
                },
                None => {
                    response = respond(StatusCode::NOT_FOUND, "Referenced client was not found".to_string())?;
                }
            }
        },
        Err(e) => {
            let error_message = format!("Malformed Json request: {}", e);
            response = respond(StatusCode::BAD_REQUEST, error_message)?;
        }
    }
    Ok(response)
}

pub async fn retrieve_messages(
    req: Request<Body>,
    retriever_store: Arc<Mutex<RetrieverStore>>,
) -> Result<Response<Body>> {
    let req_data = hyper::body::to_bytes(req.into_body()).await.unwrap();
    let response;

    let config: serde_json::Result<RetrieverConfig> = serde_json::from_slice(&req_data);
    match config {
        Ok(config) => {
            let mut retrievers = retriever_store.lock().await;
            match retrievers.get_retriever(&config.id.as_bytes()) {
                Some(retriever) => {
                    let msgs = retriever.fetch_msgs().await.unwrap();
                    response = respond(StatusCode::FOUND, serde_json::to_string(&msgs).unwrap())?
                }
                None => {
                    match Retriever::new(&config) {
                        Ok(mut retriever) => {
                            let msgs = retriever.fetch_msgs().await.unwrap();
                            retrievers.add_retriever(config.id.as_bytes().to_vec(), retriever).unwrap();
                            response = respond(StatusCode::FOUND, serde_json::to_string(&msgs).unwrap())?
                        },
                        Err(e) => {
                            let error_message = format!("Error generating retriever: {}", e);
                            response = respond(StatusCode::EXPECTATION_FAILED, error_message).unwrap()
                        }
                    }
                }
            }
        },
        Err(_) => {response = respond(StatusCode::BAD_REQUEST, "Error parsing configuration".to_string())?}
    }
    Ok(response)

}

fn respond(status: StatusCode, msg: String) -> Result<Response<Body>> {
    Ok(Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(msg)).unwrap())
}
