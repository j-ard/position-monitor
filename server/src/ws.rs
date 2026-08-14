use std::sync::Arc;

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;
use futures_util::SinkExt;
use tokio::sync::broadcast::error::RecvError;

use crate::{App, snapshot};

pub async fn handler(ws: WebSocketUpgrade, State(app): State<Arc<App>>) -> Response {
    ws.on_upgrade(move |s| session(s, app))
}

async fn session(mut socket: WebSocket, app: Arc<App>) {
    let mut rx = app.tx.subscribe();
    let mut kick = app.kick.subscribe();
    let snap = serde_json::to_string(&snapshot(&app).await).unwrap();
    if socket.send(Message::text(snap)).await.is_err() {
        return;
    }
    loop {
        tokio::select! {
            m = rx.recv() => match m {
                Ok(out) => {
                    let s = serde_json::to_string(&out).unwrap();
                    if socket.send(Message::text(s)).await.is_err() { return; }
                }
                Err(RecvError::Lagged(_)) => {
                    let snap = serde_json::to_string(&snapshot(&app).await).unwrap();
                    if socket.send(Message::text(snap)).await.is_err() { return; }
                }
                Err(RecvError::Closed) => return,
            },
            _ = kick.recv() => { let _ = socket.close().await; return; }
            m = socket.recv() => if m.is_none() { return; },
        }
    }
}
