#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let app = server::app();
    server::spawn_feed(app.clone());
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let l = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    tracing::info!("listening on :{port}");
    axum::serve(l, server::router(app)).await.unwrap();
}
