package com.repolens.retrieval;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Sawal ko PostgreSQL full-text search ke safe keywords mein badalta hai.
 * "Where is generateToken in JWTService?" -> [generatetoken, generate, token, jwtservice, jwt, service]
 *
 * Sirf a-z aur 0-9 bachte hain, isliye user ka text kabhi tsquery operator ya SQL inject nahi kar sakta.
 * camelCase bilkul waise hi toota hai jaise V5 ke content_tsv column mein, taaki dono taraf match ho.
 */
public final class QueryTokenizer {

    private static final int MAX_TOKENS = 20;

    // English + Hinglish bharti ke words: ye har jagah milte hain, sirf noise badhate hain
    private static final Set<String> STOPWORDS = Set.of(
            "the", "an", "is", "are", "was", "were", "be", "been", "am", "it", "its", "this", "that", "these", "those",
            "what", "where", "when", "how", "why", "which", "who", "whom", "does", "do", "did", "done", "in", "on",
            "of", "to", "for", "and", "or", "not", "with", "from", "by", "at", "as", "into", "can", "could", "should",
            "would", "will", "me", "my", "you", "your", "we", "our", "us", "please", "explain", "show", "tell", "give",
            "about", "there", "here", "any", "all", "some", "has", "have", "had", "get", "got", "used", "use", "using",
            "kya", "hai", "hain", "ka", "ki", "ke", "ko", "se", "mein", "kahan", "kaha", "kaise", "kyun", "kyu", "kaun",
            "kaunsa", "konsa", "ho", "hota", "hoti", "hote", "raha", "rahi", "rahe", "karo", "kar", "karta", "karti",
            "batao", "bata", "yeh", "ye", "wo", "woh", "aur", "ya", "par", "pe", "toh", "bhi", "jo", "jab", "tab",
            "sab", "kuch", "iska", "uska", "isme", "usme", "hua", "hui", "hue", "wala", "wali", "wale", "liye", "nahi");

    private QueryTokenizer() {}

    public static List<String> tokens(String question) {
        Set<String> out = new LinkedHashSet<>();
        if (question == null) {
            return List.of();
        }
        for (String raw : question.split("[^A-Za-z0-9]+")) {
            if (raw.isEmpty()) {
                continue;
            }
            add(out, raw); // generateToken -> generatetoken
            String split = raw.replaceAll("([a-z0-9])([A-Z])", "$1 $2") // generateToken -> generate Token
                    .replaceAll("([A-Z])([A-Z][a-z])", "$1 $2"); // JWTService -> JWT Service
            for (String part : split.split(" ")) {
                add(out, part);
            }
        }
        return out.stream().limit(MAX_TOKENS).toList();
    }

    /** [login, flow] -> "login | flow" (OR: chunk mein koi ek word bhi ho toh chalega) */
    public static String toTsQuery(List<String> tokens) {
        return String.join(" | ", tokens);
    }

    private static void add(Set<String> out, String word) {
        String w = word.toLowerCase(Locale.ROOT);
        if (w.length() >= 2 && !STOPWORDS.contains(w)) {
            out.add(w);
        }
    }
}
