/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type Quiz = NormalQuiz | RemovedQuiz;
/**
 * 削除の種類。問題が移動された場合は「moved」、問題が削除された場合は「deleted」が記載されます。
 */
export type RemovalType = "moved" | "deleted";
/**
 * ITクイズの一覧を記載したJSONファイルのスキーマです。
 */
export type IT = Quiz[];

export interface NormalQuiz {
  /**
   * 問題文。問題は特に読み上げに適した問題文になるようにしています。また、ルビや強調する部分がHTMLでマークアップされています。
   */
  question: string;
  /**
   * 正答。問題に対応する模範解答を表します。別解が複数ある場合は特にメインとなるものを1つ選んでいます。
   */
  answer: string;
  /**
   * 紙面出題時の問題文。より「みんはや」出題時の問題文に近い問題文がある場合、それが記載されています。
   */
  paperQuestion?: string;
  /**
   * 「みんはや」出題時の問題文。「みんはや」出題時のみ使用する問題文がある場合、それが記載されています。
   */
  minhayaQuestion?: string;
  /**
   * 別解。別解がある場合、配列の形でそれが記載されています。
   */
  alternativeAnswers?: string[];
  /**
   * 補足。問題に関する追加のメモがある場合、それが記載されています。
   */
  description?: string;
  [k: string]: unknown;
}
export interface RemovedQuiz {
  removed: {
    type: RemovalType;
    /**
     * 削除の理由
     */
    reason: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}