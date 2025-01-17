## 概要
ChatGPTとClaudeを駆使して作成したブラウザで動く録音/文字起こしサイトです。
こちらからアクセスできます。→https://rabbuttz.github.io/mojiokosi-browser/

文字起こしにはWhisperAPIとGPT-4oを使用するため、ご自身でAPIキーを発行する必要があります。
以下のサイトなどでAPIキーの取得方法が説明されているため、参照いただくとよいかと思います。
https://www.goatman.co.jp/media/chatgpt/openai-api-key/

ちなみに1分あたり0.006ドルかかるらしいです。1時間で大体60円くらいだと思います。

## 注意点
このアプリはプログラミング素人の自分が書いたものです。これを使用したことによって発生するいかなる問題について、私は責任を負いません。
一応セキュリティ面には気を付けているつもりですが、APIキーを使用・保存する関係である程度のリスクがあることをご承知ください。
プログラムはGitHubで公開しておりますが、基本的にWhisperAPIとの通信以外で外部と通信することはなく、すべての情報はクライアント側のLocalStorageに保存されます。
そのため、履歴やAPIキーなどはブラウザを削除したりLocalStorageの情報をリセットしたりすると削除されることにお気をつけください。

