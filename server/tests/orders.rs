use futures_util::FutureExt;
use futures_util::StreamExt;
use serde_json::{Value, json};
use tokio_tungstenite::connect_async;

async fn boot() -> String {
    let app = server::app();
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = l.local_addr().unwrap();
    server::spawn_feed(app.clone());
    tokio::spawn(async move { axum::serve(l, server::router(app)).await.unwrap() });
    format!("127.0.0.1:{}", addr.port())
}

async fn next_of(
    ws: &mut (
             impl StreamExt<
        Item = Result<
            tokio_tungstenite::tungstenite::Message,
            tokio_tungstenite::tungstenite::Error,
        >,
    > + Unpin
         ),
    ty: &str,
) -> Value {
    loop {
        let m = tokio::time::timeout(std::time::Duration::from_secs(3), ws.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        let v: Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
        if v["type"] == ty {
            return v;
        }
    }
}

#[tokio::test]
async fn order_fills_and_updates_position() {
    let addr = boot().await;
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    let c = reqwest::Client::new();
    let r = c
        .post(format!("http://{addr}/api/orders"))
        .json(&json!({"symbol":"META","side":"buy","qty":100}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 202);
    let oid = r.json::<Value>().await.unwrap()["order_id"]
        .as_u64()
        .unwrap();
    let fill = next_of(&mut ws, "fill").await;
    assert_eq!(fill["order_id"].as_u64().unwrap(), oid);
    assert_eq!(fill["status"], "filled");
    let pos = next_of(&mut ws, "position").await;
    assert_eq!(pos["sym"], "META");
    assert_eq!(pos["position"]["qty"], 100);
}

#[tokio::test]
async fn close_flattens_and_realizes() {
    let addr = boot().await;
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    let c = reqwest::Client::new();
    let r = c
        .post(format!("http://{addr}/api/positions/AAPL/close"))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 202);
    let pos = next_of(&mut ws, "position").await;
    assert_eq!(pos["sym"], "AAPL");
    assert!(pos["position"].is_null());
    let r2 = c
        .post(format!("http://{addr}/api/positions/AAPL/close"))
        .send()
        .await
        .unwrap();
    assert_eq!(r2.status(), 404);
}

#[tokio::test]
async fn validation_422s() {
    let addr = boot().await;
    let c = reqwest::Client::new();
    for (body, code) in [
        (
            json!({"symbol":"NOPE","side":"buy","qty":1}),
            "unknown_symbol",
        ),
        (json!({"symbol":"AAPL","side":"buy","qty":0}), "bad_qty"),
        (json!({"symbol":"AAPL","side":"buy","qty":10001}), "qty_cap"),
    ] {
        let r = c
            .post(format!("http://{addr}/api/orders"))
            .json(&body)
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 422);
        assert_eq!(r.json::<Value>().await.unwrap()["error"], code);
    }
}

#[tokio::test]
async fn chaos_stall_silences_feed() {
    let addr = boot().await;
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    next_of(&mut ws, "ticks").await;
    let c = reqwest::Client::new();
    let r = c
        .post(format!("http://{addr}/api/chaos"))
        .json(&json!({"mode":"stall","duration_ms":1500}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 204);
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    while ws.next().now_or_never().flatten().is_some() {}
    let quiet = tokio::time::timeout(std::time::Duration::from_millis(900), ws.next()).await;
    assert!(quiet.is_err());
    next_of(&mut ws, "ticks").await;
}

#[tokio::test]
async fn concurrent_close_no_opposite_position() {
    let addr = boot().await;
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    let c = reqwest::Client::new();
    let url = format!("http://{addr}/api/positions/AAPL/close");
    let (r1, r2) = tokio::join!(c.post(&url).send(), c.post(&url).send());
    assert_eq!(r1.unwrap().status(), 202);
    assert_eq!(r2.unwrap().status(), 202);

    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
    let mut nonzero_fills = 0;
    while let Some(Ok(m)) = ws.next().now_or_never().flatten() {
        let v: Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
        if v["type"] == "fill" && v["sym"] == "AAPL" && v["qty"].as_i64().unwrap_or(0) != 0 {
            nonzero_fills += 1;
        }
    }
    assert!(nonzero_fills <= 1);

    let r = c
        .get(format!("http://{addr}/api/positions"))
        .send()
        .await
        .unwrap();
    let body: Value = r.json().await.unwrap();
    assert!(
        body["positions"]
            .as_array()
            .unwrap()
            .iter()
            .all(|p| p["sym"] != "AAPL")
    );
}
