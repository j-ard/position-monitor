use futures_util::StreamExt;
use tokio_tungstenite::connect_async;

async fn boot() -> String {
    let app = server::app();
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = l.local_addr().unwrap();
    server::spawn_feed(app.clone());
    tokio::spawn(async move { axum::serve(l, server::router(app)).await.unwrap() });
    format!("127.0.0.1:{}", addr.port())
}

#[tokio::test]
async fn snapshot_first_then_ticks_and_heartbeat() {
    let addr = boot().await;
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    let first: serde_json::Value =
        serde_json::from_str(ws.next().await.unwrap().unwrap().to_text().unwrap()).unwrap();
    assert_eq!(first["type"], "snapshot");
    assert_eq!(first["symbols"].as_array().unwrap().len(), 8);
    assert_eq!(first["positions"].as_array().unwrap().len(), 6);
    let mut seen_ticks = false;
    let mut seen_beat = false;
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(3);
    while (!seen_ticks || !seen_beat) && tokio::time::Instant::now() < deadline {
        if let Ok(Some(Ok(m))) =
            tokio::time::timeout(std::time::Duration::from_secs(2), ws.next()).await
        {
            let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
            seen_ticks |= v["type"] == "ticks";
            seen_beat |= v["type"] == "heartbeat";
        }
    }
    assert!(seen_ticks && seen_beat);
}
