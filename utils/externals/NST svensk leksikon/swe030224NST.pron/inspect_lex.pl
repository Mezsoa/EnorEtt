# !perl -w

#This program inspects the content of an NST format lexicon 50 fields, semicolon-separated),
#checking transcriptions (NO sampa), validity of codes etc.

unless (@ARGV) {$ARGV[0] = "swe030224NST.pron"}

open IN, $ARGV[0];
open OUT, ">$ARGV[0]_inspect.OUT";

$counter1 = "0";
$counter2 = "0";
$counter3 = "0";
$counter4 = "0";

#DEFINING LEGAL PHONES/TAGS
$phones = '}:|2:|A:|e:|i:|u:|y:|o:|}:|u0|9|@|d`|t`|n`|l`|s`|N|r|""?|%|a|e|I|U|Y|O|E:?|b|d|g|p|t|k|f|s|v|C|m|n|l|h|j|$|_|§';
$parts_of_speech_legal = 'AB|DL|DT|IE|IN|JJ|KN|LN|NN|PF|PM|PN|PP|PS|RG|RO|VB|';	#no warning if PoS empty
$proper_name_class_legal = 'person|group|place|UNS|';
$proper_name_tag_legal = 'CIT|COM|COU|FIR|GEO|ORG|STR|SUR|UNS|FUL|';
$proper_name_loc_legal = 'home|abroad|NEU|MAS|FEM|MAS-FEM|FIC|';
$num_legal = 'SIN|PLU';
$spec_legal = 'IND|DEF';
$case_legal = 'NOM|GEN';
$gen_legal = 'MAS|FEM|NEU|UTR|MAS-FEM';
$comp_legal = 'POS|KOM|SUV';
$voice_legal = 'AKT|PAS';
$tense_legal = 'PRS|PRT|PF|PS|SUP|IMP|INF|KON|IND';

print OUT "Lexicon inspector output of $ARGV[0]\n";

while (<IN>) {
	chomp;
	$post = $_;
	@felt = split ";", $post;

#SJEKKER ANTALL FELT	
	$nos = scalar (@felt);
	$id = $felt[-1];
	if ($nos ne 51) {
		print OUT "WARNING! Entry $id $felt[0] contains wrong number of fields ($nos).\n";
	}

#SJEKKER OBLIGATORISKE FELTER 	#$felt[28],
	@oblig = "";
	@oblig = ($felt[0], $felt[3], $felt[5], $felt[11],  $felt[29], $felt[47], $felt[50]) unless $felt[7];
	#foreach $obl (@oblig) {
		#print OUT "WARNING! Entry $id $felt[0] has an empty obligatory field.\n" unless $felt[7]; #$obl;
	#}

#SJEKKER ORTOGRAFISKE SYMBOLER
	if ($felt[7] !~ /^GARB$/) {
		unless ($felt[0] =~ /^[0-9\:\'\&\/\(\)\._\-a-zÊ¯Â∆ÿ≈ˆ÷‰ƒÈ…Ë»ÙÛÚÌ·‡‚„¸‹ﬂÍÎÒÁÔ˚Ó]*$/i) {
			print OUT "ORTHOGRAPHIC SYMBOL ERROR (orth) in entry $id\t$felt[0]\n";
		}
		unless ($felt[3] =~ /^[0-9\:\'\&\/\(\)\._\-a-zÊ¯Â∆ÿ≈ˆ÷‰ƒÈ…Ë»ÙÛÚÌ·‡‚„¸‹ﬂÍÎÒÁÔ˚Ó!\+\~]*$/i) {
			print OUT "ORTHOGRAPHIC SYMBOL ERROR (decomp) in entry $id\t$felt[3]\n";
		}
	}

#SJEKKER ANTALL DECOMP MOT ANTALL DECPOS		NB! MUST BE FIXED TO HANDLE SUBFIELDS!
	@decomp = split /\+/, $felt[3];
	@decpos = split /\+/, $felt[4];
	$no_decomp = scalar (@decomp);
	$no_decpos = scalar (@decpos);
#	if (($no_decomp ne $no_decpos) && not ($felt[7])) {
#		print OUT "WARNING! Entry $id has discrepant number of decomp and decpos:\t$felt[3]\t$felt[4]\n";
#	}

#SJEKKER ANTALL LEDD I FLERORDSUTTRYKK MOT ANTALL LEDD I TRANSKRIPSJON
	@orto = split /_/, $felt[0];
	@trans = split /_/, $felt[11];
	$no_orto = scalar (@orto);
	$no_trans = scalar (@trans);
	if (($no_orto ne $no_trans) and not (($felt[7]) or ($felt[9]))) {	#IGNORES THIS CHECK FOR ACRONYMS AND ABBREVIATIONS
		print OUT "POSSIBLE UNDERSCORE ERROR in field $id\t$felt[0]\t$felt[11]\n";
	}

#SJEKKER EXTENDED POS
	($main_pos, $class_pm, $tag_pm, $loc_pm) = split /\|/, $felt[1];
	if ($main_pos !~ /^($parts_of_speech_legal)$/) {
		print OUT "POS ERROR MAIN:\t$felt[1] in field $id\t$felt[0]\n";
	}
	if ($class_pm !~ /^($proper_name_class_legal)$/) {
		print OUT "POS ERROR CLASS:\t$felt[1] in field $id\t$felt[0]\n";
	}
	if ($tag_pm !~ /^($proper_name_tag_legal)$/) {
		print OUT "POS ERROR TAG:\t$felt[1] in field $id\t$felt[0]\n";
	}
	if ($loc_pm !~ /^($proper_name_loc_legal)$/) {
		print OUT "POS ERROR LOC:\t$felt[1] in field $id\t$felt[0]\n";
	}

#SJEKKER MORFOLOGI	#SKRIV KODER OG LEGG TIL VARIABLER
	if ($main_pos =~ /^VB$/) {
		($voice, $tense, $numerus, $species, $case, $gender) = split /\|/, $felt[2];
	}
	else {
		($numerus, $species, $case, $gender, $comp) = split /\|/, $felt[2];
	}
	
	if (($numerus !~ /^$num_legal$/) && ($numerus)) {
		print OUT "MORPH ERROR NUMBER:\t$felt[2] in field $id\t$felt[0]\n";
	}
	if (($species !~ /^$spec_legal$/) && ($species)) {
		print OUT "MORPH ERROR SPECIES:\t$felt[2] in field $id\t$felt[0]\n";
	}
	if (($case !~ /^$case_legal$/) && ($case)) {
		print OUT "MORPH ERROR CASE:\t$felt[2] in field $id\t$felt[0]\n";
	}
	if (($gender !~ /^$gen_legal$/) && ($gender)) {
		print OUT "MORPH ERROR GENDER:\t$felt[2] in field $id\t$felt[0]\n";
	}
	if (($comp !~ /^$comp_legal$/) && ($comp)) {
		print OUT "MORPH ERROR COMPARISON:\t$felt[2] in field $id\t$felt[0]\n";
	}
	if (($voice !~ /^$voice_legal$/) && ($voice)) {
		print OUT "MORPH ERROR VOICE:\t$felt[2] in field $id\t$felt[0]\n";
	}
	if (($tense !~ /^$tense_legal$/) && ($tense)) {
		print OUT "MORPH ERROR TENSE:\t$felt[2] in field $id\t$felt[0]\n";
	}

#SJEKKER DECPOS
	foreach $ps (@decpos) {
		if ($ps !~ /^($parts_of_speech_legal)$/) {
			print OUT "DECPOS ERROR:\t$ps\t$felt[2] in entry $id\t$felt[1]\n";
		}
	}
	if (($felt[3] =~ /\-/) && ($felt[4] !~ /DL/) && ($felt[4] =~ /\+/)) {
		print OUT "WRONG DECPOS, tag DL missing:\t$felt[3] in field $id\t$felt[4]\n";
	}
		
#TRANSKIPSJONSTELLING
	$trans1 = $felt[11];
	$trans2 = $felt[15];
	$trans3 = $felt[19];
	$trans4 = $felt[23];

	if ($trans1) {
		$counter1++;
		unless ($felt[7]) {
			unless (($felt[12]) && ($felt[13]) && ($felt[14])) {
#				print OUT "WARNING! Entry $id contains transcription field 11 but not corresponding code field(s).\n";
			}
		}
	}
	
	else {
		print OUT "WARNING! Entry $id $felt[1] contains empty transcription field 11.\n";
	}
	
	if ($trans2) {
		$counter2++;
		unless (($felt[16]) && ($felt[17]) && ($felt[18])) {
			print OUT "WARNING! Entry $id contains transcription field 15 but not corresponding code field(s).\n";
		}

	}
	if ($trans3) {
		$counter3++;
		unless (($felt[20]) && ($felt[21]) && ($felt[22])) {
			print OUT "WARNING! Entry $id contains transcription field 19 but not corresponding code field(s).\n";
		}

	}
	if ($trans4) {
		$counter4++;
		unless (($felt[24]) && ($felt[25]) && ($felt[26])) {
			print OUT "WARNING! Entry $id contains transcription field 15 but not corresponding code field(s).\n";
		}
	}

#SAMPA TRANSKRIPSJONSKONTROLL
	@alts = split /\|/, $felt[27];
	push @allalts, @alts;
	@trks = ($felt[11],$felt[15],$felt[19],$felt[23],@alts);
	foreach $trans (@trks) {
		$check = $trans;
		$check =~ s/(a\*U|E\*U)/~/g;
		$check =~ s/\$/~/g;
		$check =~ s/s\'/~/g;
		$check =~ s/$phones/~/g;
		$check =~ s/x\\/~/g;
		if ($check =~ /[^~]/) {
			print OUT "SYMBOL ERROR:\t$check\t$line in field $id\t$felt[0]\t$trans\n";
		}
	}

#KLARGJÿR HASHER FOR STATISTIKK
#	$hash0{$felt[0]}++;
	$hash1{$felt[1]}++;
	$hash2{$felt[2]}++;
#	$hash3{$felt[3]}++;
	$hash4{$felt[4]}++;
	$hash5{$felt[5]}++;
	$hash6{$felt[6]}++;
	$hash7{$felt[7]}++;
	$hash8{$felt[8]}++;
	$hash9{$felt[9]}++;
#	$hash10{$felt[10]}++;
#	$hash11{$felt[11]}++;
	$hash12{$felt[12]}++;
	$hash13{$felt[13]}++;
	$hash14{$felt[14]}++;
#	$hash15{$felt[15]}++;
	$hash16{$felt[16]}++;
	$hash17{$felt[17]}++;
	$hash18{$felt[18]}++;
#	$hash19{$felt[19]}++;
	$hash20{$felt[20]}++;
	$hash21{$felt[21]}++;
	$hash22{$felt[22]}++;
#	$hash23{$felt[23]}++;
	$hash24{$felt[24]}++;
	$hash25{$felt[25]}++;
	$hash26{$felt[26]}++;
#	$hash27{$felt[27]}++;
#	$hash28{$felt[28]}++;
	$hash29{$felt[29]}++;
	$hash30{$felt[30]}++;
	$hash31{$felt[31]}++;
#	$hash32{$felt[32]}++;
	$hash33{$felt[33]}++;
	$hash34{$felt[34]}++;
	$hash35{$felt[35]}++;
#	$hash36{$felt[36]}++;
	$hash37{$felt[37]}++;
	$hash38{$felt[38]}++;
	$hash39{$felt[39]}++;
	$hash40{$felt[40]}++;
	$hash41{$felt[41]}++;
	$hash42{$felt[42]}++;
	$hash43{$felt[43]}++;
	$hash44{$felt[44]}++;
	$hash45{$felt[45]}++;
#	$hash46{$felt[46]}++;
#	$hash47{$felt[47]}++;
#	$hash48{$felt[48]}++;
	$hash49{$felt[49]}++;
#	$hash50{$felt[50]}++;

	$entry = $.;
	print "Processed $entry entries\n" if $entry =~ /000$/;
}

#UTSKRIFTER AV STATISTIKK OG INNHOLD

print "Reading completed\n";

$altvs = scalar @allalts;
print OUT "\n\nCONTENTS OF LEXICON\n";
print OUT "Words containing one transcription:\t$counter1\n";
print OUT "Words containing two transcriptions:\t$counter2\n";
print OUT "Words containing three transcriptions:\t$counter3\n";
print OUT "Words containing four transcriptions:\t$counter4\n";
print OUT "Sum automatically generated variants:\t$altvs\n";
$sum = $counter1+$counter2+$counter3+$counter4+$altvs;
print OUT "Total number of transcriptions:\t$sum\n\n";

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 1 - EXTENDED POS\n";
foreach $key (sort keys %hash1) {
	print OUT "$key\t$hash1{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 2 - MORPHOLOGY\n";
foreach $key (sort keys %hash2) {
	print OUT "$key\t$hash2{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 4 - DECPOS\n";
foreach $key (sort keys %hash4) {
	print OUT "$key\t$hash4{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 5 - SOURCE\n";
foreach $key (sort keys %hash5) {
	print OUT "$key\t$hash5{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 6 - LANGUAGE CODE ORTHOGRAPHY\n";
foreach $key (sort keys %hash6) {
	print OUT "$key\t$hash6{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 7 - GARBAGE\n";
foreach $key (sort keys %hash7) {
	print OUT "$key\t$hash7{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 8 - DOMAIN\n";
foreach $key (sort keys %hash8) {
	print OUT "$key\t$hash8{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 9 - ABBR/ACR\n";
foreach $key (sort keys %hash9) {
	print OUT "$key\t$hash9{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 12 - CERTAINTY TRANS 1\n";
foreach $key (sort keys %hash12) {
	print OUT "$key\t$hash12{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 13 - STATUS TRANS 1\n";
foreach $key (sort keys %hash13) {
	print OUT "$key\t$hash13{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 14 - LANGUAGE CODE TRANS 1\n";
foreach $key (sort keys %hash14) {
	print OUT "$key\t$hash14{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 16 - CERTAINTY TRANS 2\n";
foreach $key (sort keys %hash16) {
	print OUT "$key\t$hash16{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 17 - STATUS TRANS 2\n";
foreach $key (sort keys %hash17) {
	print OUT "$key\t$hash17{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 18 - LANGUAGE CODE TRANS 2\n";
foreach $key (sort keys %hash18) {
	print OUT "$key\t$hash18{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 20 - CERTAINTY TRANS 3\n";
foreach $key (sort keys %hash20) {
	print OUT "$key\t$hash20{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 21 - STATUS TRANS 3\n";
foreach $key (sort keys %hash21) {
	print OUT "$key\t$hash21{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 22 - LANGUAGE CODE TRANS 3\n";
foreach $key (sort keys %hash22) {
	print OUT "$key\t$hash22{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 24 - CERTAINTY TRANS 4\n";
foreach $key (sort keys %hash24) {
	print OUT "$key\t$hash24{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 25 - STATUS TRANS 4\n";
foreach $key (sort keys %hash25) {
	print OUT "$key\t$hash25{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 26 - LANGUAGE CODE TRANS 4\n";
foreach $key (sort keys %hash26) {
	print OUT "$key\t$hash26{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 29 - SET NAME\n";
foreach $key (sort keys %hash29) {
	print OUT "$key\t$hash29{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 30 - STYLE/STATUS\n";
foreach $key (sort keys %hash30) {
	print OUT "$key\t$hash30{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 31 - INFLECTOR ROLE\n";
foreach $key (sort keys %hash31) {
	print OUT "$key\t$hash31{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 33 - INFLECTION RULE\n";
foreach $key (sort keys %hash33) {
	print OUT "$key\t$hash33{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 34 - MORPH LABEL\n";
foreach $key (sort keys %hash34) {
	print OUT "$key\t$hash34{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 35 - COMPOUNDER CODE\n";
foreach $key (sort keys %hash35) {
	print OUT "$key\t$hash35{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 37 - \n";
foreach $key (sort keys %hash37) {
	print OUT "$key\t$hash37{$key}\n";
}

print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 38 - \n";
foreach $key (sort keys %hash38) {
	print OUT "$key\t$hash38{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 39 - \n";
foreach $key (sort keys %hash39) {
	print OUT "$key\t$hash39{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 40 - \n";
foreach $key (sort keys %hash40) {
	print OUT "$key\t$hash40{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 41 - \n";
foreach $key (sort keys %hash41) {
	print OUT "$key\t$hash41{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 42 - \n";
foreach $key (sort keys %hash42) {
	print OUT "$key\t$hash42{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 43 - \n";
foreach $key (sort keys %hash43) {
	print OUT "$key\t$hash43{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 44 - \n";
foreach $key (sort keys %hash44) {
	print OUT "$key\t$hash44{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 45 - \n";
foreach $key (sort keys %hash45) {
	print OUT "$key\t$hash45{$key}\n";
}
print OUT "--------------------\n";
print OUT "CONTENTS OF FIELD 49 - UPDATE INFO\n";
foreach $key (sort keys %hash49) {
	print OUT "$key\t$hash49{$key}\n";
}
